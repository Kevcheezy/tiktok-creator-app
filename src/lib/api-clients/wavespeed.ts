export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ImageOptions {
  aspectRatio?: string;
  resolution?: string;
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

export class WaveSpeedClient {
  private apiKey: string;
  private baseUrl = 'https://api.wavespeed.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.WAVESPEED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('WaveSpeedClient: No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WaveSpeed API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: ChatCompletionOptions = {}
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
    });

    return data.data?.outputs?.[0] || '';
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<{ taskId: string }> {
    const { aspectRatio = '2:3' } = options || {};

    const data = await this.request('/api/v3/google/nano-banana-pro/text-to-image-multi', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        aspect_ratio: aspectRatio,
        num_images: 2,
        output_format: 'png',
        enable_sync_mode: false,
      }),
    });

    return { taskId: data.data?.id };
  }

  async editImage(
    images: string[],
    prompt: string,
    options?: { aspectRatio?: string; resolution?: string }
  ): Promise<{ taskId: string }> {
    const { aspectRatio = '9:16', resolution = '1k' } = options || {};

    const data = await this.request('/api/v3/google/nano-banana-pro/edit', {
      method: 'POST',
      body: JSON.stringify({
        images,
        prompt,
        aspect_ratio: aspectRatio,
        resolution,
        output_format: 'png',
        enable_sync_mode: false,
      }),
    });

    return { taskId: data.data?.id };
  }

  async generateVideo(params: VideoParams): Promise<{ taskId: string }> {
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
    });

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
      const response = await fetch(config.url, {
        headers: { Authorization: `Bearer ${config.authKey}` },
      });

      if (!response.ok) {
        throw new Error(`Poll error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      const status = config.extractStatus(data);

      if (config.successStatuses.includes(status)) {
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
