import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { API_COSTS } from '@/lib/constants';

const SEGMENTS = [0, 1, 2, 3];

export class DirectorAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('DirectorAgent', supabaseClient);
  }

  async run(projectId: string): Promise<void> {
    this.log(`Starting directing for project ${projectId}`);

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
    for (const segIdx of SEGMENTS) {
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
        throw new Error(`Start keyframe not found for segment ${segIdx}`);
      }

      // Build multi_prompt from shot_scripts
      const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
      const multiPrompt = (shotScripts || []).map((shot: { index: number; text: string; energy: string }) => ({
        prompt: `${shot.text}. Energy: ${shot.energy}. Camera follows subject naturally.`,
        duration: '5',
      }));

      // Build main prompt from scene context
      const mainPrompt = [
        scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
        scene.section ? `Section: ${scene.section}` : '',
        'Natural movement, professional lighting, TikTok style video, 9:16 portrait',
      ].filter(Boolean).join('. ');

      const negativePrompt = 'watermark, text overlay, blurry, distorted, flickering, low quality, static, frozen';

      this.log(`Generating video for segment ${segIdx}`);

      const result = await this.wavespeed.generateVideo({
        image: startKeyframe.url,
        tailImage: endKeyframe?.url,
        prompt: mainPrompt,
        negativePrompt,
        multiPrompt,
        duration: 15,
        cfgScale: 0.5,
      });

      // Create asset row
      await this.supabase.from('asset').insert({
        project_id: projectId,
        scene_id: scene.id,
        type: 'video',
        provider: 'kling-3.0-pro',
        provider_task_id: result.taskId,
        status: 'generating',
        cost_usd: API_COSTS.klingVideo,
      });

      // Poll until complete (up to 5 minutes)
      this.log(`Polling video task ${result.taskId} (up to 5 min)...`);
      const pollResult = await this.wavespeed.pollResult(result.taskId);

      // Update asset with URL
      await this.supabase
        .from('asset')
        .update({ url: pollResult.url || '', status: 'completed' })
        .eq('provider_task_id', result.taskId);

      await this.trackCost(projectId, API_COSTS.klingVideo);
      this.log(`Video complete for segment ${segIdx}: ${pollResult.url}`);
    }

    this.log(`Directing complete for project ${projectId}`);
  }
}
