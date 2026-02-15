import { createLogger, logToGenerationLog } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger({ agentName: 'CreatomateClient' });

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

export interface CreatomateCallContext {
  projectId?: string;
  correlationId?: string;
  supabase?: SupabaseClient;
}

export class CreatomateClient {
  private apiKey: string;
  private baseUrl = 'https://api.creatomate.com/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CREATOMATE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}, context?: CreatomateCallContext): Promise<any> {
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
          { provider: 'Creatomate', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
          `API call failed: ${error}`
        );

        if (context?.supabase && context?.projectId) {
          await logToGenerationLog(context.supabase, {
            project_id: context.projectId,
            correlation_id: context.correlationId,
            event_type: 'api_call',
            agent_name: 'CreatomateClient',
            detail: { provider: 'Creatomate', endpoint: path, method: options.method || 'GET', statusCode, latencyMs, error },
          });
        }

        throw new Error(`Creatomate API error (${response.status}): ${error}`);
      }

      logger.info(
        { provider: 'Creatomate', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        'API call completed'
      );

      if (context?.supabase && context?.projectId) {
        await logToGenerationLog(context.supabase, {
          project_id: context.projectId,
          correlation_id: context.correlationId,
          event_type: 'api_call',
          agent_name: 'CreatomateClient',
          detail: { provider: 'Creatomate', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        });
      }

      return response.json();
    } catch (err) {
      if (statusCode === undefined) {
        const latencyMs = Date.now() - start;
        logger.error(
          { provider: 'Creatomate', endpoint: path, method: options.method || 'GET', error: (err as Error).message, latencyMs },
          'API call failed (network error)'
        );
      }
      throw err;
    }
  }

  async renderVideo(options: RenderOptions, context?: CreatomateCallContext): Promise<RenderResult> {
    const body: Record<string, unknown> = {
      template_id: options.templateId,
      modifications: options.modifications,
    };

    if (options.maxWidth) body.max_width = options.maxWidth;
    if (options.maxHeight) body.max_height = options.maxHeight;

    const data = await this.request('/renders', {
      method: 'POST',
      body: JSON.stringify(body),
    }, context);

    // Creatomate returns an array of renders
    const render = Array.isArray(data) ? data[0] : data;
    return {
      id: render.id,
      status: render.status,
      url: render.url,
    };
  }

  async getRenderStatus(renderId: string, context?: CreatomateCallContext): Promise<RenderResult> {
    const data = await this.request(`/renders/${renderId}`, {}, context);
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
        const totalPollMs = Date.now() - startTime;
        logger.info({ provider: 'Creatomate', renderId, totalPollMs }, 'Render poll completed successfully');
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
