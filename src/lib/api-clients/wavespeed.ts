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
    const { model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 4096 } = options;

    const data = await this.request('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    return data.choices?.[0]?.message?.content || '';
  }

  async generateImage(prompt: string, _options?: ImageOptions): Promise<{ taskId: string }> {
    throw new Error('NotImplemented: Image generation will be available in Phase 3');
  }

  async generateVideo(_params: VideoParams): Promise<{ taskId: string }> {
    throw new Error('NotImplemented: Video generation will be available in Phase 3');
  }

  async pollResult(_taskId: string): Promise<{ status: string; url?: string }> {
    throw new Error('NotImplemented: Poll result will be available in Phase 3');
  }
}
