import { createLogger, logToGenerationLog } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger({ agentName: 'ElevenLabsClient' });

export interface ElevenLabsCallContext {
  projectId?: string;
  correlationId?: string;
  supabase?: SupabaseClient;
}

export class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}, context?: ElevenLabsCallContext): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const start = Date.now();
    let statusCode: number | undefined;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
          ...options.headers,
        },
      });

      statusCode = response.status;
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const error = await response.text();
        logger.error(
          { provider: 'ElevenLabs', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
          `API call failed: ${error}`
        );

        if (context?.supabase && context?.projectId) {
          await logToGenerationLog(context.supabase, {
            project_id: context.projectId,
            correlation_id: context.correlationId,
            event_type: 'api_call',
            agent_name: 'ElevenLabsClient',
            detail: { provider: 'ElevenLabs', endpoint: path, method: options.method || 'GET', statusCode, latencyMs, error },
          });
        }

        throw new Error(`ElevenLabs API error (${response.status}): ${error}`);
      }

      logger.info(
        { provider: 'ElevenLabs', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        'API call completed'
      );

      if (context?.supabase && context?.projectId) {
        await logToGenerationLog(context.supabase, {
          project_id: context.projectId,
          correlation_id: context.correlationId,
          event_type: 'api_call',
          agent_name: 'ElevenLabsClient',
          detail: { provider: 'ElevenLabs', endpoint: path, method: options.method || 'GET', statusCode, latencyMs },
        });
      }

      return response.json();
    } catch (err) {
      if (statusCode === undefined) {
        const latencyMs = Date.now() - start;
        logger.error(
          { provider: 'ElevenLabs', endpoint: path, method: options.method || 'GET', error: (err as Error).message, latencyMs },
          'API call failed (network error)'
        );
      }
      throw err;
    }
  }

  /**
   * Generate a new voice from a text description.
   * Returns a temporary generated_voice_id that must be saved to make permanent.
   */
  async designVoice(description: string, sampleText: string, context?: ElevenLabsCallContext): Promise<string> {
    const data = await this.request('/v1/text-to-speech/voice-design/preview', {
      method: 'POST',
      body: JSON.stringify({
        voice_description: description,
        text: sampleText,
      }),
    }, context);
    return data.generated_voice_id;
  }

  /**
   * Save a designed voice to the library, making it permanent.
   * Returns the permanent voice_id.
   */
  async saveVoice(generatedVoiceId: string, name: string, description?: string, context?: ElevenLabsCallContext): Promise<string> {
    const data = await this.request('/v1/voice-generation/create-voice-from-preview', {
      method: 'POST',
      body: JSON.stringify({
        voice_name: name,
        voice_description: description || '',
        generated_voice_id: generatedVoiceId,
        labels: { source: 'tiktok-creator-app' },
      }),
    }, context);
    return data.voice_id;
  }

  /**
   * Generate speech from text using a specific voice.
   * Returns audio as a Buffer (MP3 format).
   *
   * Note: ElevenLabs TTS returns audio bytes directly, not JSON.
   */
  async textToSpeech(voiceId: string, text: string, context?: ElevenLabsCallContext): Promise<Buffer> {
    const endpoint = `/v1/text-to-speech/${voiceId}`;
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const error = await response.text();
        logger.error(
          { provider: 'ElevenLabs', endpoint, method: 'POST', statusCode: response.status, latencyMs },
          `TTS call failed: ${error}`
        );

        if (context?.supabase && context?.projectId) {
          await logToGenerationLog(context.supabase, {
            project_id: context.projectId,
            correlation_id: context.correlationId,
            event_type: 'api_call',
            agent_name: 'ElevenLabsClient',
            detail: { provider: 'ElevenLabs', endpoint, method: 'POST', statusCode: response.status, latencyMs, error },
          });
        }

        throw new Error(`ElevenLabs TTS error (${response.status}): ${error}`);
      }

      logger.info(
        { provider: 'ElevenLabs', endpoint, method: 'POST', statusCode: response.status, latencyMs },
        'TTS call completed'
      );

      if (context?.supabase && context?.projectId) {
        await logToGenerationLog(context.supabase, {
          project_id: context.projectId,
          correlation_id: context.correlationId,
          event_type: 'api_call',
          agent_name: 'ElevenLabsClient',
          detail: { provider: 'ElevenLabs', endpoint, method: 'POST', statusCode: response.status, latencyMs },
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      const latencyMs = Date.now() - start;
      // Only log if we haven't already logged above (i.e., network-level failure)
      if (!(err instanceof Error && err.message.startsWith('ElevenLabs TTS error'))) {
        logger.error(
          { provider: 'ElevenLabs', endpoint, method: 'POST', error: (err as Error).message, latencyMs },
          'TTS call failed (network error)'
        );
      }
      throw err;
    }
  }

  /**
   * Check if a voice_id is still valid on ElevenLabs.
   */
  async isVoiceValid(voiceId: string): Promise<boolean> {
    try {
      await this.request(`/v1/voices/${voiceId}`);
      return true;
    } catch {
      return false;
    }
  }
}
