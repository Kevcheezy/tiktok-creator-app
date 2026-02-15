import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';
import { VOICE_MAPPING, FALLBACK_VOICES, API_COSTS } from '@/lib/constants';

const SEGMENTS = [0, 1, 2, 3];

export class VoiceoverAgent extends BaseAgent {
  private elevenlabs: ElevenLabsClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('VoiceoverAgent', supabaseClient);
    this.elevenlabs = new ElevenLabsClient();
  }

  async run(projectId: string): Promise<void> {
    this.log(`Starting voiceover for project ${projectId}`);

    // 1. Fetch project with character
    const { data: project, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !project) throw new Error('Project not found');

    // 2. Resolve voice
    const voiceId = await this.resolveVoice(project);
    this.log(`Using voice: ${voiceId}`);

    // 3. Get the approved script's latest scenes
    const { data: scripts } = await this.supabase
      .from('script')
      .select('id')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const scriptId = scripts?.[0]?.id;
    if (!scriptId) throw new Error('No script found');

    const { data: allScenes } = await this.supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .order('segment_index')
      .order('version', { ascending: false });

    const latestScenes = new Map<number, any>();
    for (const scene of allScenes || []) {
      if (!latestScenes.has(scene.segment_index)) {
        latestScenes.set(scene.segment_index, scene);
      }
    }

    // 4. Generate TTS for each segment
    for (const segIdx of SEGMENTS) {
      const scene = latestScenes.get(segIdx);
      if (!scene?.script_text) {
        this.log(`Scene or script_text for segment ${segIdx} not found, skipping`);
        continue;
      }

      this.log(`Generating TTS for segment ${segIdx} (${scene.script_text.length} chars)`);

      // Generate audio
      const audioBuffer = await this.elevenlabs.textToSpeech(voiceId, scene.script_text);

      // Upload to Supabase Storage
      const fileName = `projects/${projectId}/audio/segment-${segIdx}.mp3`;
      const { error: uploadError } = await this.supabase.storage
        .from('assets')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        this.log(`Storage upload failed: ${uploadError.message}. Storing as data URI instead.`);
        // Fallback: store as base64 data URI
        const base64 = audioBuffer.toString('base64');
        const dataUri = `data:audio/mpeg;base64,${base64}`;

        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'audio',
          provider: 'elevenlabs',
          status: 'completed',
          url: dataUri,
          cost_usd: API_COSTS.elevenLabsTts,
        });
      } else {
        // Get public URL
        const { data: urlData } = this.supabase.storage
          .from('assets')
          .getPublicUrl(fileName);

        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'audio',
          provider: 'elevenlabs',
          status: 'completed',
          url: urlData.publicUrl,
          cost_usd: API_COSTS.elevenLabsTts,
        });
      }

      await this.trackCost(projectId, API_COSTS.elevenLabsTts);
      this.log(`TTS complete for segment ${segIdx}`);
    }

    this.log(`Voiceover complete for project ${projectId}`);
  }

  private async resolveVoice(project: any): Promise<string> {
    const character = project.character;
    const category = project.product_category || 'supplements';

    // 1. Check if character already has a voice_id
    if (character?.voice_id) {
      const isValid = await this.elevenlabs.isVoiceValid(character.voice_id);
      if (isValid) {
        return character.voice_id;
      }
      this.log(`Cached voice ${character.voice_id} is invalid, generating new one`);
    }

    // 2. Try to generate a voice via Voice Design
    const voiceMapping = VOICE_MAPPING[category.toLowerCase()] ||
      VOICE_MAPPING[Object.keys(VOICE_MAPPING)[0]];
    const gender = voiceMapping?.gender || 'male';
    const voiceDescription = voiceMapping?.description || 'Professional, clear, engaging speaker';

    try {
      const sampleText = 'Hey, I just tried this product and honestly, I was not expecting these results.';

      this.log(`Designing voice: ${voiceDescription}`);
      const generatedVoiceId = await this.elevenlabs.designVoice(voiceDescription, sampleText);

      this.log(`Saving voice to library`);
      const permanentVoiceId = await this.elevenlabs.saveVoice(
        generatedVoiceId,
        `${category}-voice-${Date.now()}`,
        voiceDescription,
      );

      // Cache on character
      if (character?.id) {
        await this.supabase
          .from('ai_character')
          .update({ voice_id: permanentVoiceId })
          .eq('id', character.id);
      }

      return permanentVoiceId;
    } catch (error) {
      this.log(`Voice design failed: ${error instanceof Error ? error.message : error}. Using fallback.`);

      // 3. Fallback to preset voices
      const fallback = gender === 'female' ? FALLBACK_VOICES.female : FALLBACK_VOICES.male;
      return fallback.voiceId;
    }
  }
}
