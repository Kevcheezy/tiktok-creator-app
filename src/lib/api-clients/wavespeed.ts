import { createLogger, logToGenerationLog } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger({ agentName: 'WaveSpeedClient' });

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ImageOptions {
  aspectRatio?: string;
  resolution?: string;
  width?: number;
  height?: number;
}

export interface VideoParams {
  image: string;
  tailImage?: string;   // end frame URL for Kling 3.0 start-end feature
  prompt: string;
  negativePrompt?: string;
  multiPrompt?: { prompt: string; duration: string }[];
  duration?: number;
  cfgScale?: number;
  sound?: boolean;
}

export interface ApiCallContext {
  projectId?: string;
  correlationId?: string;
  supabase?: SupabaseClient;
}

/** Detect AbortController abort errors across all Node.js versions. */
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError';
}

export class WaveSpeedClient {
  private apiKey: string;
  private baseUrl = 'https://api.wavespeed.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.WAVESPEED_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}, context?: ApiCallContext, timeoutMs: number = 120000): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const start = Date.now();
    let statusCode: number | undefined;

    try {
      // Two-layer timeout: AbortController cancels the connection,
      // Promise.race guarantees resolution even if AbortController fails.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await Promise.race([
          fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              ...options.headers,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`WaveSpeed API timeout (${timeoutMs / 1000}s): ${path}`)), timeoutMs + 5000)
          ),
        ]);
      } finally {
        clearTimeout(timeoutId);
      }

      statusCode = response.status;
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const error = await response.text();
        logger.error(
          { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
          `API call failed: ${error}`
        );

        if (context?.supabase && context?.projectId) {
          await logToGenerationLog(context.supabase, {
            project_id: context.projectId,
            correlation_id: context.correlationId,
            event_type: 'api_call',
            agent_name: 'WaveSpeedClient',
            detail: { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', statusCode, latencyMs, error },
          });
        }

        throw new Error(`WaveSpeed API error (${response.status}): ${error}`);
      }

      logger.info(
        { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        'API call completed'
      );

      if (context?.supabase && context?.projectId) {
        await logToGenerationLog(context.supabase, {
          project_id: context.projectId,
          correlation_id: context.correlationId,
          event_type: 'api_call',
          agent_name: 'WaveSpeedClient',
          detail: { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        });
      }

      return response.json();
    } catch (err) {
      if (statusCode === undefined) {
        const latencyMs = Date.now() - start;
        const isTimeout = isAbortError(err) ||
          (err instanceof Error && err.message.includes('API timeout'));
        const errorMsg = isTimeout
          ? `Request timed out after ${timeoutMs / 1000}s`
          : (err as Error).message;
        logger.error(
          { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', error: errorMsg, latencyMs, timeout: isTimeout },
          isTimeout ? 'API call timed out' : 'API call failed (network error)'
        );
        if (isTimeout) {
          throw new Error(`WaveSpeed API timeout (${timeoutMs / 1000}s): ${path}`);
        }
      }
      throw err;
    }
  }

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: ChatCompletionOptions = {},
    context?: ApiCallContext
  ): Promise<string> {
    const { model = 'google/gemini-2.5-flash', temperature = 0.7, maxTokens = 4096 } = options;

    const data = await this.request('/api/v3/wavespeed-ai/any-llm', {
      method: 'POST',
      body: JSON.stringify({
        prompt: userPrompt,
        system_prompt: systemPrompt,
        model,
        temperature,
        max_tokens: maxTokens,
        enable_sync_mode: true,
      }),
    }, context);

    return data.data?.outputs?.[0] || '';
  }

  async generateImage(prompt: string, options?: ImageOptions, context?: ApiCallContext): Promise<{ taskId: string }> {
    const { aspectRatio = '9:16', width, height } = options || {};

    const body: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio,
      num_images: 2,
      output_format: 'png',
      enable_sync_mode: false,
    };

    if (width) body.width = width;
    if (height) body.height = height;

    const data = await this.request('/api/v3/google/nano-banana-pro/text-to-image-multi', {
      method: 'POST',
      body: JSON.stringify(body),
    }, context);

    return { taskId: data.data?.id };
  }

  async editImage(
    images: string[],
    prompt: string,
    options?: { aspectRatio?: string; resolution?: string },
    context?: ApiCallContext
  ): Promise<{ taskId: string }> {
    const { aspectRatio = '9:16', resolution = '1k' } = options || {};

    const body: Record<string, unknown> = {
      images,
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: 'png',
      enable_sync_mode: false,
    };

    const data = await this.request('/api/v3/google/nano-banana-pro/edit', {
      method: 'POST',
      body: JSON.stringify(body),
    }, context);

    return { taskId: data.data?.id };
  }

  async generateVideo(params: VideoParams, context?: ApiCallContext): Promise<{ taskId: string }> {
    const { image, tailImage, prompt, negativePrompt, multiPrompt, duration = 15, cfgScale = 0.5, sound = true } = params;

    const body: Record<string, unknown> = {
      image,
      prompt,
      negative_prompt: negativePrompt || '',
      multi_prompt: (multiPrompt || []).map(mp => ({
        prompt: mp.prompt,
        duration: typeof mp.duration === 'number' ? mp.duration : parseInt(mp.duration, 10),
      })),
      duration,
      cfg_scale: cfgScale,
      sound,
    };

    if (tailImage) {
      body.tail_image = tailImage;
    }

    const data = await this.request('/api/v3/kwaivgi/kling-v3.0-pro/image-to-video', {
      method: 'POST',
      body: JSON.stringify(body),
    }, context);

    return { taskId: data.data?.id };
  }

  async upscaleImage(
    imageUrl: string,
    options?: { targetResolution?: '2k' | '4k' | '8k'; outputFormat?: 'jpeg' | 'png' | 'webp' },
    context?: ApiCallContext
  ): Promise<{ taskId: string }> {
    const { targetResolution = '4k', outputFormat = 'png' } = options || {};

    const data = await this.request('/api/v3/wavespeed-ai/image-upscaler', {
      method: 'POST',
      body: JSON.stringify({
        image: imageUrl,
        target_resolution: targetResolution,
        output_format: outputFormat,
        enable_sync_mode: false,
      }),
    }, context);

    return { taskId: data.data?.id };
  }

  async pollResult(
    taskId: string,
    options?: { maxWait?: number; initialInterval?: number; shouldCancel?: () => Promise<boolean> }
  ): Promise<{ status: string; url?: string }> {
    const config = {
      url: `${this.baseUrl}/api/v3/predictions/${taskId}/result`,
      authKey: this.apiKey,
      maxWait: options?.maxWait ?? 300000,
      initialInterval: options?.initialInterval ?? 10000,
      maxInterval: 30000,
      backoffFactor: 1.3,
      perRequestTimeout: 30000,
      extractUrl: (data: any) => data.data?.outputs?.[0],
      extractStatus: (data: any) => data.data?.status,
      successStatuses: ['completed'],
      failStatuses: ['failed'],
    };

    const startTime = Date.now();
    let interval = config.initialInterval;

    while (Date.now() - startTime < config.maxWait) {
      // Check for cancellation before polling
      if (options?.shouldCancel) {
        const cancelled = await options.shouldCancel();
        if (cancelled) {
          logger.info({ taskId }, 'Poll cancelled by shouldCancel callback');
          const { CancellationError } = await import('../../lib/errors');
          throw new CancellationError(`Task ${taskId} cancelled by user`);
        }
      }

      try {
        // Promise.race guarantees this resolves within perRequestTimeout,
        // regardless of whether AbortController works in this runtime.
        const data = await Promise.race([
          (async () => {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), config.perRequestTimeout);
            try {
              const response = await fetch(config.url, {
                headers: { Authorization: `Bearer ${config.authKey}` },
                signal: controller.signal,
              });
              if (!response.ok) {
                throw new Error(`Poll error (${response.status}): ${await response.text()}`);
              }
              return response.json();
            } finally {
              clearTimeout(tid);
            }
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('POLL_REQUEST_TIMEOUT')), config.perRequestTimeout + 5000)
          ),
        ]);

        const status = config.extractStatus(data);

        if (config.successStatuses.includes(status)) {
          const latencyMs = Date.now() - startTime;
          logger.info({ provider: 'WaveSpeed', taskId, totalPollMs: latencyMs }, 'Poll completed successfully');
          return { status: 'completed', url: config.extractUrl(data) };
        }

        if (config.failStatuses.includes(status)) {
          throw new Error(`Task ${taskId} failed: ${JSON.stringify(data.data?.error || data.data?.message || 'Unknown error')}`);
        }
      } catch (err) {
        const isTimeout = isAbortError(err) ||
          (err instanceof Error && err.message === 'POLL_REQUEST_TIMEOUT');
        if (isTimeout) {
          logger.warn({ taskId, elapsed: Date.now() - startTime }, 'Poll request timed out, retrying...');
          // fall through to sleep + continue
        } else {
          throw err;
        }
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      interval = Math.min(interval * config.backoffFactor, config.maxInterval);
    }

    throw new Error(`Task ${taskId} timed out after ${config.maxWait / 1000}s`);
  }
}
