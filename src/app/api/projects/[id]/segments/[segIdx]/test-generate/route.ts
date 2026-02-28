import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger, logToGenerationLog } from '@/lib/logger';
import { resolveNegativePrompt } from '@/lib/prompt-schema';
import { buildVideoPromptJSON } from '@/lib/prompt-serializer';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { VideoModelConfig, getFallbackVideoModel, API_COSTS } from '@/lib/constants';

export const maxDuration = 180; // 3 minutes — LLM prompt generation can take 60s+

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

  const routeStart = Date.now();

  try {
    const segIdx = parseInt(segIdxStr, 10);
    if (isNaN(segIdx) || segIdx < 0) {
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    logger.info({ projectId: id, segIdx }, 'Test-generate: starting');

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

    // Build video prompt JSON directly from scene data — no LLM needed.
    // Uses visual_prompt (from CastingAgent), script_text, shot_scripts, energy_arc.
    const serialized = buildVideoPromptJSON(scene, { shotDuration: vm.shot_duration, lockCamera });

    // Call wavespeed.generateVideo with JSON prompt
    logger.info({ projectId: id, segIdx, hasEndKeyframe: !!endKeyframe?.url, elapsed: Date.now() - routeStart }, 'Test-generate: calling WaveSpeed video API');
    const wavespeed = new WaveSpeedClient();
    const result = await wavespeed.generateVideo({
      image: startKeyframe.url,
      tailImage: vm.supports_tail_image ? endKeyframe?.url : undefined,
      prompt: serialized.prompt,
      negativePrompt: serialized.negativePrompt || negativePrompt,
      multiPrompt: [],  // Dropped: JSON prompt handles timing via action.sequence
      duration: vm.segment_duration,
      cfgScale: 0.5,
    }, { projectId: id, supabase });

    // Delete old test video assets for this segment to prevent stale display on refresh
    await supabase
      .from('asset')
      .delete()
      .eq('scene_id', scene.id)
      .eq('type', 'video');

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

    logger.info({ projectId: id, segIdx, taskId: result.taskId, assetId: asset?.id, elapsed: Date.now() - routeStart }, 'Test-generate: video job submitted');

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
