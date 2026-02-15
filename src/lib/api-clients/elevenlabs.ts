export class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabsClient: No API key provided');
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Generate a new voice from a text description.
   * Returns a temporary generated_voice_id that must be saved to make permanent.
   */
  async designVoice(description: string, sampleText: string): Promise<string> {
    const data = await this.request('/v1/text-to-speech/voice-design/preview', {
      method: 'POST',
      body: JSON.stringify({
        voice_description: description,
        text: sampleText,
      }),
    });
    return data.generated_voice_id;
  }

  /**
   * Save a designed voice to the library, making it permanent.
   * Returns the permanent voice_id.
   */
  async saveVoice(generatedVoiceId: string, name: string, description?: string): Promise<string> {
    const data = await this.request('/v1/voice-generation/create-voice-from-preview', {
      method: 'POST',
      body: JSON.stringify({
        voice_name: name,
        voice_description: description || '',
        generated_voice_id: generatedVoiceId,
        labels: { source: 'tiktok-creator-app' },
      }),
    });
    return data.voice_id;
  }

  /**
   * Generate speech from text using a specific voice.
   * Returns audio as a Buffer (MP3 format).
   *
   * Note: ElevenLabs TTS returns audio bytes directly, not JSON.
   */
  async textToSpeech(voiceId: string, text: string): Promise<Buffer> {
    const url = `${this.baseUrl}/v1/text-to-speech/${voiceId}`;
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS error (${response.status}): ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
