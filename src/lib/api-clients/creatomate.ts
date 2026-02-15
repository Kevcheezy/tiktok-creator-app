export interface RenderOptions {
  templateId: string;
  modifications: Record<string, string>;
  maxWidth?: number;
  maxHeight?: number;
}

export interface RenderResult {
  id: string;
  status: string;
  url?: string;
}

export class CreatomateClient {
  private apiKey: string;
  private baseUrl = 'https://api.creatomate.com/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CREATOMATE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('CreatomateClient: No API key provided');
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
      throw new Error(`Creatomate API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async renderVideo(options: RenderOptions): Promise<RenderResult> {
    const body: Record<string, unknown> = {
      template_id: options.templateId,
      modifications: options.modifications,
    };

    if (options.maxWidth) body.max_width = options.maxWidth;
    if (options.maxHeight) body.max_height = options.maxHeight;

    const data = await this.request('/renders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Creatomate returns an array of renders
    const render = Array.isArray(data) ? data[0] : data;
    return {
      id: render.id,
      status: render.status,
      url: render.url,
    };
  }

  async getRenderStatus(renderId: string): Promise<RenderResult> {
    const data = await this.request(`/renders/${renderId}`);
    return {
      id: data.id,
      status: data.status,
      url: data.url,
    };
  }

  async pollRender(
    renderId: string,
    options?: { maxWait?: number; interval?: number }
  ): Promise<RenderResult> {
    const maxWait = options?.maxWait ?? 300000;
    const interval = options?.interval ?? 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const result = await this.getRenderStatus(renderId);

      if (result.status === 'succeeded') {
        return result;
      }

      if (result.status === 'failed') {
        throw new Error(`Creatomate render ${renderId} failed`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Creatomate render ${renderId} timed out after ${maxWait / 1000}s`);
  }
}
