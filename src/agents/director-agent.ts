import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { API_COSTS } from '@/lib/constants';

export class DirectorAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('DirectorAgent', supabaseClient);
  }

  async run(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'directing');
    this.log(`Starting directing for project ${projectId}`);

    const vm = this.videoModel;

    // 1. Get the approved script
    const { data: scripts } = await this.supabase
      .from('script')
      .select('id')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const scriptId = scripts?.[0]?.id;
    if (!scriptId) throw new Error('No script found');

    // 2. Fetch latest scenes
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

    // 3. For each segment, generate video from start+end keyframes
    for (let segIdx = 0; segIdx < vm.segment_count; segIdx++) {
      const scene = latestScenes.get(segIdx);
      if (!scene) {
        this.log(`Scene for segment ${segIdx} not found, skipping`);
        continue;
      }

      // Fetch keyframe assets for this scene
      const { data: keyframes } = await this.supabase
        .from('asset')
        .select('*')
        .eq('scene_id', scene.id)
        .in('type', ['keyframe_start', 'keyframe_end'])
        .eq('status', 'completed');

      const startKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_start');
      const endKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_end');

      if (!startKeyframe?.url) {
        this.log(`Start keyframe not found for segment ${segIdx}, creating failed video asset`);
        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'video',
          provider: vm.slug,
          status: 'failed',
          cost_usd: 0,
        });
        continue;
      }

      // Build multi_prompt from shot_scripts
      const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
      const shotDuration = String(vm.shot_duration);
      const multiPrompt = (shotScripts || []).map((shot: { index: number; text: string; energy: string }) => ({
        prompt: `${shot.text}. Energy: ${shot.energy}. Camera follows subject naturally.`,
        duration: shotDuration,
      }));

      // Build main prompt from scene context
      const mainPrompt = [
        scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
        scene.section ? `Section: ${scene.section}` : '',
        `Natural movement, professional lighting, TikTok style video, ${vm.aspect_ratio} portrait`,
      ].filter(Boolean).join('. ');

      const negativePrompt = 'watermark, text overlay, blurry, distorted, flickering, low quality, static, frozen';

      // Generate video with retry logic
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            this.log(`Retry ${attempt}/${maxRetries} for segment ${segIdx} after 10s delay...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
          }

          this.log(`Generating video for segment ${segIdx} (attempt ${attempt + 1})`);

          const result = await this.wavespeed.generateVideo({
            image: startKeyframe.url,
            tailImage: vm.supports_tail_image ? endKeyframe?.url : undefined,
            prompt: mainPrompt,
            negativePrompt,
            multiPrompt: vm.supports_multi_prompt ? multiPrompt : [],
            duration: vm.segment_duration,
            cfgScale: 0.5,
          });

          await this.supabase.from('asset').insert({
            project_id: projectId,
            scene_id: scene.id,
            type: 'video',
            provider: vm.slug,
            provider_task_id: result.taskId,
            status: 'generating',
            cost_usd: vm.cost_per_segment,
          });

          this.log(`Polling video task ${result.taskId} (up to 5 min)...`);
          const pollResult = await this.wavespeed.pollResult(result.taskId);

          await this.supabase
            .from('asset')
            .update({ url: pollResult.url || '', status: 'completed' })
            .eq('provider_task_id', result.taskId);

          await this.trackCost(projectId, vm.cost_per_segment);
          this.log(`Video complete for segment ${segIdx}: ${pollResult.url}`);
          lastError = null;
          break;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.log(`Video generation failed for segment ${segIdx}: ${lastError.message}`);
        }
      }

      if (lastError) {
        this.log(`All retries exhausted for segment ${segIdx}, marking as failed`);
        await this.supabase.from('asset').insert({
          project_id: projectId,
          scene_id: scene.id,
          type: 'video',
          provider: vm.slug,
          status: 'failed',
          cost_usd: 0,
        });
      }
    }

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'directing', { durationMs });
    this.log(`Directing complete for project ${projectId}`);
  }
}
