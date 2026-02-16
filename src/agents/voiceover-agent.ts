import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';
import { VOICE_MAPPING, CATEGORY_TO_PERSONA, FALLBACK_VOICES, API_COSTS } from '@/lib/constants';

// ElevenLabs returns ~128kbps MP3 audio. Bytes per second = 128000 / 8 = 16000.
const ELEVENLABS_BYTES_PER_SECOND = 128000 / 8;

export class VoiceoverAgent extends BaseAgent {
  private elevenlabs: ElevenLabsClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('VoiceoverAgent', supabaseClient);
    this.elevenlabs = new ElevenLabsClient();
  }

  async run(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'voiceover');
    this.log(`Starting voiceover for project ${projectId}`);

    // 1. Fetch project with character
    const { data: project, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !project) throw new Error('Project not found');

    // 2. Resolve voice (B0.22: uses CATEGORY_TO_PERSONA bridge map)
    const voiceId = await this.resolveVoice(project, projectId);
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

    const segmentDuration = this.videoModel?.segment_duration || 15;

    // 4. Generate TTS for each segment (with per-segment error recovery)
    let segmentsCompleted = 0;
    for (let segIdx = 0; segIdx < this.videoModel.segment_count; segIdx++) {
      const scene = latestScenes.get(segIdx);
      if (!scene?.script_text?.trim()) {
        this.log(`Scene or script_text for segment ${segIdx} not found, skipping`);
        continue;
      }

      try {
        this.log(`Generating TTS for segment ${segIdx} (${scene.script_text.length} chars)`);

        // Generate audio
        const audioBuffer = await this.elevenlabs.textToSpeech(voiceId, scene.script_text);

        // B0.21: Measure actual audio duration from MP3 buffer (128kbps)
        const durationSeconds = audioBuffer.length / ELEVENLABS_BYTES_PER_SECOND;
        const durationMs = Math.round(durationSeconds * 1000);
        const durationRatio = durationSeconds / segmentDuration;

        this.log(`Audio for segment ${segIdx}: ${durationSeconds.toFixed(2)}s (${(durationRatio * 100).toFixed(0)}% of ${segmentDuration}s target), ${(audioBuffer.length / 1024).toFixed(1)}KB`);

        // B0.21: Warn if duration is outside 80%-100% of segment_duration
        if (durationRatio < 0.80) {
          const detail = {
            segmentIndex: segIdx,
            durationSeconds: parseFloat(durationSeconds.toFixed(2)),
            segmentDuration,
            durationRatio: parseFloat(durationRatio.toFixed(3)),
            issue: 'audio_too_short',
          };
          this.log(`Warning: Audio for segment ${segIdx} is short (${(durationRatio * 100).toFixed(0)}% of target) — may leave dead silence at segment end`, detail);
          await this.logEvent(projectId, 'audio_duration_warning', 'voiceover', detail);
        } else if (durationRatio > 1.0) {
          const detail = {
            segmentIndex: segIdx,
            durationSeconds: parseFloat(durationSeconds.toFixed(2)),
            segmentDuration,
            durationRatio: parseFloat(durationRatio.toFixed(3)),
            issue: 'audio_too_long',
          };
          this.log(`Warning: Audio for segment ${segIdx} exceeds target (${(durationRatio * 100).toFixed(0)}% of target) — Creatomate may clip audio`, detail);
          await this.logEvent(projectId, 'audio_duration_warning', 'voiceover', detail);

          // B0.21: If audio exceeds segment duration by >2s, log a segment_error event
          if (durationSeconds > segmentDuration + 2) {
            const errorDetail = {
              segmentIndex: segIdx,
              durationSeconds: parseFloat(durationSeconds.toFixed(2)),
              segmentDuration,
              excessSeconds: parseFloat((durationSeconds - segmentDuration).toFixed(2)),
              issue: 'audio_exceeds_segment_by_2s',
            };
            this.log(`Error: Audio for segment ${segIdx} exceeds segment duration by ${(durationSeconds - segmentDuration).toFixed(1)}s — will be clipped`, errorDetail);
            await this.logEvent(projectId, 'segment_error', 'voiceover', errorDetail);
          }
        }

        // Upload to Supabase Storage
        const fileName = `projects/${projectId}/audio/segment-${segIdx}.mp3`;
        const { error: uploadError } = await this.supabase.storage
          .from('assets')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        // B0.23: If Storage upload fails, treat as segment failure (no data URI fallback)
        if (uploadError) {
          const uploadErrorDetail = {
            segmentIndex: segIdx,
            bucket: 'assets',
            path: fileName,
            error: uploadError.message,
          };
          this.log(`Storage upload failed for segment ${segIdx}: ${uploadError.message}`, uploadErrorDetail);
          await this.logEvent(projectId, 'segment_error', 'voiceover', uploadErrorDetail);

          // Create failed asset instead of storing a data URI
          await this.supabase.from('asset').insert({
            project_id: projectId,
            scene_id: scene.id,
            type: 'audio',
            provider: 'elevenlabs',
            status: 'failed',
            cost_usd: API_COSTS.elevenLabsTts,
            metadata: { error: `Storage upload failed: ${uploadError.message}`, durationMs },
          });

          // Still track cost since the TTS API call was made
          await this.trackCost(projectId, API_COSTS.elevenLabsTts);
          continue;
        }

        // Get public URL
        const { data: urlData } = this.supabase.storage
          .from('assets')
          .getPublicUrl(fileName);

        // B0.21: Store measured duration in asset.metadata.durationMs
        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'audio',
          provider: 'elevenlabs',
          status: 'completed',
          url: urlData.publicUrl,
          cost_usd: API_COSTS.elevenLabsTts,
          metadata: { durationMs },
        });

        await this.trackCost(projectId, API_COSTS.elevenLabsTts);
        segmentsCompleted++;
        this.log(`TTS complete for segment ${segIdx}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.log(`TTS failed for segment ${segIdx}: ${errMsg}`);
        await this.logEvent(projectId, 'segment_error', 'voiceover', {
          segmentIndex: segIdx,
          error: errMsg,
        });
        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'audio',
          provider: 'elevenlabs',
          status: 'failed',
          cost_usd: 0,
          metadata: { error: errMsg },
        });
      }
    }

    if (segmentsCompleted === 0) {
      throw new Error('All segments failed during voiceover generation');
    }

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'voiceover', { durationMs });
    this.log(`Voiceover complete for project ${projectId}`);
  }

  /**
   * Resolve the ElevenLabs voice ID for a project.
   * B0.22: Uses CATEGORY_TO_PERSONA bridge map to correctly resolve product_category → persona → voice.
   */
  private async resolveVoice(project: any, projectId: string): Promise<string> {
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

    // 2. B0.22: Resolve persona via CATEGORY_TO_PERSONA bridge map
    const persona = CATEGORY_TO_PERSONA[category.toLowerCase()];
    const voiceMapping = persona
      ? VOICE_MAPPING[persona]
      : VOICE_MAPPING[Object.keys(VOICE_MAPPING)[0]];

    if (!persona) {
      this.log(`Warning: No persona mapping for category "${category}", falling back to first persona (${Object.keys(VOICE_MAPPING)[0]})`);
    }

    const resolvedPersona = persona || Object.keys(VOICE_MAPPING)[0];
    const gender = voiceMapping?.gender || 'male';
    const voiceDescription = voiceMapping?.description || 'Professional, clear, engaging speaker';

    // B0.22: Log which persona was selected for debugging
    await this.logEvent(projectId, 'voice_selected', 'voiceover', {
      category,
      persona: resolvedPersona,
      gender,
      voiceDescription,
      mappedViaBridge: !!persona,
    });

    this.log(`Voice persona resolved: category="${category}" -> persona="${resolvedPersona}" (${gender})`, {
      category,
      persona: resolvedPersona,
      gender,
    });

    // 3. Try to generate a voice via Voice Design
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

      // 4. Fallback to preset voices
      const fallback = gender === 'female' ? FALLBACK_VOICES.female : FALLBACK_VOICES.male;
      return fallback.voiceId;
    }
  }
}
