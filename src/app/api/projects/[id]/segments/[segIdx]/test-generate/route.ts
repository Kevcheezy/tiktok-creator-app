import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger, logToGenerationLog } from '@/lib/logger';
import { StructuredPrompt, isStructuredPrompt, resolveNegativePrompt, STRUCTURED_PROMPT_SCHEMA_DESCRIPTION } from '@/lib/prompt-schema';
import { serializeForVideo } from '@/lib/prompt-serializer';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { VideoModelConfig, getFallbackVideoModel, API_COSTS } from '@/lib/constants';

export const maxDuration = 30;

/**
 * Fetch the video model config for a project.
 */
async function getVideoModelForProject(projectId: string): Promise<VideoModelConfig> {
  const { data: proj } = await supabase
    .from('project')
    .select('video_model_id')
    .eq('id', projectId)
    .single();

  if (proj?.video_model_id) {
    const { data: vm } = await supabase
      .from('video_model')
      .select('*')
      .eq('id', proj.video_model_id)
      .single();

    if (vm) return vm as VideoModelConfig;
  }

  return getFallbackVideoModel();
}

/**
 * Generate a fresh StructuredPrompt via LLM (same logic as DirectorAgent.generateVideoPrompt).
 */
async function generateVideoPrompt(
  scene: any,
  segIdx: number,
  negativePrompt: string,
  vm: VideoModelConfig,
): Promise<StructuredPrompt> {
  const wavespeed = new WaveSpeedClient();
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
Energy arc: ${energyArc?.pattern?.start || 'LOW'} -> ${energyArc?.pattern?.middle || 'PEAK'} -> ${energyArc?.pattern?.end || 'LOW'}
${energyArc?.description || ''}

Shot scripts:
${shotList || '  No shot scripts available'}

Camera: ${cameraSpecs?.angle || 'medium'} shot, ${cameraSpecs?.movement || 'static'}, ${cameraSpecs?.lighting || 'natural'} lighting
Aspect ratio: ${vm.aspect_ratio}
Duration: ${vm.segment_duration}s (${vm.shots_per_segment} shots x ${vm.shot_duration}s each)

Generate action.sequence with ${vm.shots_per_segment} entries matching the shot scripts.
Focus on natural movement, energy transitions, and product interaction timing.`;

  const response = await wavespeed.chatCompletion(systemPrompt, userPrompt);
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as StructuredPrompt;
}

/**
 * POST /api/projects/[id]/segments/[segIdx]/test-generate
 *
 * Generate a single test video for one segment. Creates a real asset record.
 * Frontend polls for completion using existing asset polling.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; segIdx: string }> }
) {
  const { id, segIdx: segIdxStr } = await params;

  try {
    const segIdx = parseInt(segIdxStr, 10);
    if (isNaN(segIdx) || segIdx < 0) {
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    // Fetch project
    const { data: project, error: projError } = await supabase
      .from('project')
      .select('id, status, negative_prompt_override, lock_camera')
      .eq('id', id)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const vm = await getVideoModelForProject(id);

    if (segIdx >= vm.segment_count) {
      return NextResponse.json(
        { error: `Segment index ${segIdx} out of range (max: ${vm.segment_count - 1})` },
        { status: 400 }
      );
    }

    // Fetch scene
    const { data: scripts } = await supabase
      .from('script')
      .select('id')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const scriptId = scripts?.[0]?.id;
    if (!scriptId) {
      return NextResponse.json({ error: 'No script found for this project' }, { status: 404 });
    }

    const { data: scenes } = await supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .eq('segment_index', segIdx)
      .order('version', { ascending: false })
      .limit(1);

    const scene = scenes?.[0];
    if (!scene) {
      return NextResponse.json({ error: `Scene for segment ${segIdx} not found` }, { status: 404 });
    }

    // Fetch keyframes
    const { data: keyframes } = await supabase
      .from('asset')
      .select('id, type, url, status')
      .eq('scene_id', scene.id)
      .in('type', ['keyframe_start', 'keyframe_end'])
      .eq('status', 'completed');

    const startKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_start');
    const endKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_end');

    if (!startKeyframe?.url) {
      return NextResponse.json(
        { error: 'Start keyframe not found or not completed. Cannot generate test video.' },
        { status: 400 }
      );
    }

    const negativePrompt = resolveNegativePrompt(project, 'directing');
    const lockCamera = project.lock_camera ?? false;

    // Get the StructuredPrompt (override or generate fresh)
    let structuredPrompt: StructuredPrompt;
    const promptOverride = scene.video_prompt_override as StructuredPrompt | null;
    if (promptOverride && isStructuredPrompt(promptOverride)) {
      structuredPrompt = promptOverride;
    } else {
      // Check if scene has structured visual_prompt from CastingAgent
      const visualPrompt = scene.visual_prompt as { start: unknown; end: unknown } | null;
      const hasStructuredPrompt = visualPrompt && isStructuredPrompt(visualPrompt.start);

      if (hasStructuredPrompt) {
        structuredPrompt = await generateVideoPrompt(scene, segIdx, negativePrompt, vm);
        // Track LLM cost
        await supabase.rpc('increment_project_cost', {
          p_project_id: id,
          p_amount: parseFloat(API_COSTS.wavespeedChat.toFixed(4)),
        });
      } else {
        // Legacy path: build a basic serialized prompt without LLM
        const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
        const shotDuration = String(vm.shot_duration);
        const legacyCameraNote = lockCamera ? 'Static locked camera.' : 'Camera follows subject naturally.';
        const multiPrompt = (shotScripts || []).map((shot: any) => ({
          prompt: `${shot.text}. Energy: ${shot.energy}. ${legacyCameraNote}`,
          duration: shotDuration,
        }));
        const movementNote = lockCamera ? 'Static locked camera' : 'Natural movement';
        const mainPrompt = [
          scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
          scene.section ? `Section: ${scene.section}` : '',
          `${movementNote}, professional lighting, TikTok style video, ${vm.aspect_ratio} portrait`,
        ].filter(Boolean).join('. ');
        const legacyNegativePrompt = lockCamera
          ? negativePrompt + ', camera movement, camera shake, camera pan, camera zoom, camera tilt'
          : negativePrompt;

        // Generate video directly with legacy prompts
        const wavespeed = new WaveSpeedClient();
        const result = await wavespeed.generateVideo({
          image: startKeyframe.url,
          tailImage: vm.supports_tail_image ? endKeyframe?.url : undefined,
          prompt: mainPrompt,
          negativePrompt: legacyNegativePrompt,
          multiPrompt: vm.supports_multi_prompt ? multiPrompt : [],
          duration: vm.segment_duration,
          cfgScale: 0.5,
        }, { projectId: id, supabase });

        // Create asset record
        const { data: asset } = await supabase.from('asset').insert({
          project_id: id,
          scene_id: scene.id,
          type: 'video',
          provider: vm.slug,
          provider_task_id: result.taskId,
          status: 'generating',
          cost_usd: vm.cost_per_segment,
        }).select('id').single();

        // Track cost
        await supabase.rpc('increment_project_cost', {
          p_project_id: id,
          p_amount: parseFloat(vm.cost_per_segment.toFixed(4)),
        });

        // Log test generation
        await logToGenerationLog(supabase, {
          project_id: id,
          event_type: 'test_generate',
          agent_name: 'VideoPreview',
          stage: 'casting_review',
          detail: { segmentIndex: segIdx, sceneId: scene.id, taskId: result.taskId, cost: vm.cost_per_segment, legacy: true },
        });

        return NextResponse.json({
          assetId: asset?.id,
          taskId: result.taskId,
          cost: vm.cost_per_segment,
        });
      }
    }

    // Serialize the StructuredPrompt for video
    const shotDuration = String(vm.shot_duration);
    const serialized = serializeForVideo(structuredPrompt, { shotDuration, lockCamera });

    // Call wavespeed.generateVideo with the same parameters DirectorAgent would use
    const wavespeed = new WaveSpeedClient();
    const result = await wavespeed.generateVideo({
      image: startKeyframe.url,
      tailImage: vm.supports_tail_image ? endKeyframe?.url : undefined,
      prompt: serialized.prompt,
      negativePrompt: serialized.negativePrompt || negativePrompt,
      multiPrompt: vm.supports_multi_prompt ? serialized.multiPrompt : [],
      duration: vm.segment_duration,
      cfgScale: 0.5,
    }, { projectId: id, supabase });

    // Create asset record
    const { data: asset } = await supabase.from('asset').insert({
      project_id: id,
      scene_id: scene.id,
      type: 'video',
      provider: vm.slug,
      provider_task_id: result.taskId,
      status: 'generating',
      cost_usd: vm.cost_per_segment,
    }).select('id').single();

    // Track cost
    await supabase.rpc('increment_project_cost', {
      p_project_id: id,
      p_amount: parseFloat(vm.cost_per_segment.toFixed(4)),
    });

    // Log test generation
    await logToGenerationLog(supabase, {
      project_id: id,
      event_type: 'test_generate',
      agent_name: 'VideoPreview',
      stage: 'casting_review',
      detail: { segmentIndex: segIdx, sceneId: scene.id, taskId: result.taskId, cost: vm.cost_per_segment },
    });

    return NextResponse.json({
      assetId: asset?.id,
      taskId: result.taskId,
      cost: vm.cost_per_segment,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error, route: '/api/projects/[id]/segments/[segIdx]/test-generate' }, 'Error generating test video');
    return NextResponse.json(
      { error: `Failed to generate test video: ${errMsg}` },
      { status: 500 }
    );
  }
}
