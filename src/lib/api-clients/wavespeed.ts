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
}

export interface ApiCallContext {
  projectId?: string;
  correlationId?: string;
  supabase?: SupabaseClient;
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

  private async request(path: string, options: RequestInit = {}, context?: ApiCallContext): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const start = Date.now();
    let statusCode: number | undefined;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

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
        logger.error(
          { provider: 'WaveSpeed', endpoint: path, method: options.method || 'GET', error: (err as Error).message, latencyMs },
          'API call failed (network error)'
        );
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
    const { image, tailImage, prompt, negativePrompt, multiPrompt, duration = 15, cfgScale = 0.5 } = params;

    const body: Record<string, unknown> = {
      image,
      prompt,
      negative_prompt: negativePrompt || '',
      multi_prompt: multiPrompt || [],
      duration,
      cfg_scale: cfgScale,
      sound: false,
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
    options?: { maxWait?: number; initialInterval?: number }
  ): Promise<{ status: string; url?: string }> {
    const config = {
      url: `${this.baseUrl}/api/v3/predictions/${taskId}/result`,
      authKey: this.apiKey,
      maxWait: options?.maxWait ?? 300000,
      initialInterval: options?.initialInterval ?? 10000,
      maxInterval: 30000,
      backoffFactor: 1.3,
      extractUrl: (data: any) => data.data?.outputs?.[0],
      extractStatus: (data: any) => data.data?.status,
      successStatuses: ['completed'],
      failStatuses: ['failed'],
    };

    const startTime = Date.now();
    let interval = config.initialInterval;

    while (Date.now() - startTime < config.maxWait) {
      const pollStart = Date.now();
      const response = await fetch(config.url, {
        headers: { Authorization: `Bearer ${config.authKey}` },
      });

      if (!response.ok) {
        const latencyMs = Date.now() - pollStart;
        logger.error(
          { provider: 'WaveSpeed', endpoint: `/api/v3/predictions/${taskId}/result`, method: 'GET', statusCode: response.status, latencyMs },
          'Poll request failed'
        );
        throw new Error(`Poll error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      const status = config.extractStatus(data);

      if (config.successStatuses.includes(status)) {
        const latencyMs = Date.now() - startTime;
        logger.info({ provider: 'WaveSpeed', taskId, totalPollMs: latencyMs }, 'Poll completed successfully');
        return { status: 'completed', url: config.extractUrl(data) };
      }

      if (config.failStatuses.includes(status)) {
        throw new Error(`Task ${taskId} failed: ${JSON.stringify(data.data?.error || data.data?.message || 'Unknown error')}`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      interval = Math.min(interval * config.backoffFactor, config.maxInterval);
    }

    throw new Error(`Task ${taskId} timed out after ${config.maxWait / 1000}s`);
  }
}
