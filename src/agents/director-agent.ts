import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { CancellationError } from '@/lib/errors';
import { API_COSTS, VIDEO_POLL_MAX_WAIT } from '@/lib/constants';
import { StructuredPrompt, STRUCTURED_PROMPT_SCHEMA_DESCRIPTION, isStructuredPrompt, resolveNegativePrompt } from '@/lib/prompt-schema';
import { serializeForVideoJSON } from '@/lib/prompt-serializer';

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

    // 2b. Fetch project for negative prompt override and video retries config
    const { data: project } = await this.supabase
      .from('project')
      .select('negative_prompt_override, video_retries, lock_camera')
      .eq('id', projectId)
      .single();

    const negativePrompt = resolveNegativePrompt(project, 'directing');
    const lockCamera = project?.lock_camera ?? false;

    // 3. For each segment, generate video from start+end keyframes
    for (let segIdx = 0; segIdx < vm.segment_count; segIdx++) {
      const scene = latestScenes.get(segIdx);
      if (!scene) {
        this.log(`Scene for segment ${segIdx} not found, skipping`);
        continue;
      }

      // R1.5.29: Check if segment already has a completed test video (pre-tested via preview panel)
      const { data: existingVideo } = await this.supabase
        .from('asset')
        .select('id')
        .eq('scene_id', scene.id)
        .eq('type', 'video')
        .eq('status', 'completed')
        .limit(1);

      if (existingVideo && existingVideo.length > 0) {
        this.log(`Segment ${segIdx} already has approved test video (${existingVideo[0].id}), skipping`);
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

      // R1.5.29: Check for video_prompt_override (set by preview/refine panel)
      const promptOverride = scene.video_prompt_override as StructuredPrompt | null;

      let mainPrompt: string;
      let effectiveNegativePrompt: string;

      if (promptOverride && isStructuredPrompt(promptOverride)) {
        // R1.5.29: Use override directly — skip LLM prompt generation
        this.log(`Segment ${segIdx}: using video_prompt_override from preview panel`);
        const serialized = serializeForVideoJSON(promptOverride, { lockCamera });
        mainPrompt = serialized.prompt;
        effectiveNegativePrompt = serialized.negativePrompt;
      } else {
        // Check if scene has structured visual_prompt (from CastingAgent R1.5.19)
        const visualPrompt = scene.visual_prompt as { start: unknown; end: unknown } | null;
        const hasStructuredPrompt = visualPrompt && isStructuredPrompt(visualPrompt.start);

        if (hasStructuredPrompt) {
          // Use LLM to generate a StructuredPrompt for video, then serialize as JSON
          this.log(`Segment ${segIdx}: generating video StructuredPrompt via LLM`);
          try {
            const videoPrompt = await this.generateVideoPrompt(scene, segIdx, negativePrompt);
            await this.trackCost(projectId, API_COSTS.wavespeedChat);

            if (isStructuredPrompt(videoPrompt)) {
              const serialized = serializeForVideoJSON(videoPrompt, { lockCamera });
              mainPrompt = serialized.prompt;
              effectiveNegativePrompt = serialized.negativePrompt;
            } else {
              throw new Error('LLM did not return valid StructuredPrompt');
            }
          } catch (llmError) {
            this.log(`Video StructuredPrompt LLM failed, falling back to legacy: ${llmError instanceof Error ? llmError.message : String(llmError)}`);
            const movementNote = lockCamera ? 'Static locked camera' : 'Natural movement';
            mainPrompt = [
              scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
              scene.section ? `Section: ${scene.section}` : '',
              `${movementNote}, professional lighting, TikTok style video, ${vm.aspect_ratio} portrait`,
            ].filter(Boolean).join('. ');
            effectiveNegativePrompt = lockCamera
              ? negativePrompt + ', camera movement, camera shake, camera pan, camera zoom, camera tilt'
              : negativePrompt;
          }
        } else {
          // Legacy path: no structured prompt available
          const movementNote = lockCamera ? 'Static locked camera' : 'Natural movement';
          mainPrompt = [
            scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
            scene.section ? `Section: ${scene.section}` : '',
            `${movementNote}, professional lighting, TikTok style video, ${vm.aspect_ratio} portrait`,
          ].filter(Boolean).join('. ');
          effectiveNegativePrompt = lockCamera
            ? negativePrompt + ', camera movement, camera shake, camera pan, camera zoom, camera tilt'
            : negativePrompt;
        }
      }

      // Generate video with retry logic (configurable per project, default 0 = no retries)
      const maxRetries = project?.video_retries ?? 0;
      let lastError: Error | null = null;
      let apiCallsMade = 0;
      let segmentSuccess = false;

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
            negativePrompt: effectiveNegativePrompt,
            multiPrompt: [],  // Dropped: JSON prompt handles timing via action.sequence
            duration: vm.segment_duration,
            cfgScale: 0.5,
          });

          // API call succeeded — count it for cost tracking
          apiCallsMade++;

          await this.supabase.from('asset').insert({
            project_id: projectId,
            scene_id: scene.id,
            type: 'video',
            provider: vm.slug,
            provider_task_id: result.taskId,
            status: 'generating',
            cost_usd: vm.cost_per_segment,
          });

          this.log(`Polling video task ${result.taskId} (up to 15 min)...`);
          const pollResult = await this.wavespeed.pollResult(result.taskId, { maxWait: VIDEO_POLL_MAX_WAIT, shouldCancel: this.shouldCancel });

          await this.supabase
            .from('asset')
            .update({ url: pollResult.url || '', status: 'completed' })
            .eq('provider_task_id', result.taskId);

          this.log(`Video complete for segment ${segIdx}: ${pollResult.url}`);
          segmentSuccess = true;
          lastError = null;
          break;

        } catch (error) {
          if (error instanceof CancellationError) throw error;
          lastError = error instanceof Error ? error : new Error(String(error));
          this.log(`Video generation failed for segment ${segIdx}: ${lastError.message}`);
        }
      }

      // Track cost ONCE outside the retry loop — covers all actual API calls made
      if (apiCallsMade > 0) {
        await this.trackCost(projectId, vm.cost_per_segment * apiCallsMade);
      }

      if (!segmentSuccess && lastError) {
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

  /**
   * Uses LLM to generate a StructuredPrompt for video generation.
   * Replaces generic string concatenation with scene-aware, energy-arc-driven prompts.
   */
  private async generateVideoPrompt(
    scene: any,
    segIdx: number,
    negativePrompt: string,
  ): Promise<StructuredPrompt> {
    const vm = this.videoModel;
    const energyArc = vm.energy_arc[segIdx];
    const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
    const cameraSpecs = scene.camera_specs as { angle?: string; movement?: string; lighting?: string } | null;

    const systemPrompt = `You are a video prompt engineer for Kling 3.0 Pro video generation.
Generate a StructuredPrompt JSON for a ${vm.segment_duration}-second TikTok video segment.
The video will be generated from start/end keyframe images — focus on motion, energy, and timing.

${STRUCTURED_PROMPT_SCHEMA_DESCRIPTION}

Use the negative_prompt: "${negativePrompt}"

Output ONLY valid JSON matching the StructuredPrompt schema.`;

    const shotList = (shotScripts || []).map((s: any) => `  Shot ${s.index} (${vm.shot_duration}s): "${s.text}" [energy: ${s.energy}]`).join('\n');

    const userPrompt = `Segment ${segIdx} (${scene.section || 'unknown'}):
Script: ${scene.script_text || 'N/A'}
Energy arc: ${energyArc?.pattern?.start || 'LOW'} → ${energyArc?.pattern?.middle || 'PEAK'} → ${energyArc?.pattern?.end || 'LOW'}
${energyArc?.description || ''}

Shot scripts:
${shotList || '  No shot scripts available'}

Camera: ${cameraSpecs?.angle || 'medium'} shot, ${cameraSpecs?.movement || 'static'}, ${cameraSpecs?.lighting || 'natural'} lighting
Aspect ratio: ${vm.aspect_ratio}
Duration: ${vm.segment_duration}s (${vm.shots_per_segment} shots x ${vm.shot_duration}s each)

Generate action.sequence with ${vm.shots_per_segment} entries matching the shot scripts.
Focus on natural movement, energy transitions, and product interaction timing.`;

    const response = await this.wavespeed.chatCompletion(systemPrompt, userPrompt);

    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as StructuredPrompt;
  }
}
