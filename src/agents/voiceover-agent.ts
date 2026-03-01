import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';
import { API_COSTS } from '@/lib/constants';

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

    // 1. Fetch project with influencer AND character (fallback for pre-voice-design projects)
    const { data: project, error: projError } = await this.supabase
      .from('project')
      .select('*, influencer:influencer(*), character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (projError || !project) throw new Error('Project not found');

    // 2. Resolve voice_id: influencer voice (designed) -> character voice (legacy fallback)
    let voiceId = project?.influencer?.voice_id;
    if (!voiceId) {
      voiceId = project?.character?.voice_id;
    }
    if (!voiceId) {
      throw new Error('Influencer has no designed voice. Design a voice from the Influencer page before running the pipeline.');
    }
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

    const segmentDuration = this.videoModel?.segment_duration || 10;

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
}
