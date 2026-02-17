import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger, logToGenerationLog } from '@/lib/logger';
import { StructuredPrompt, isStructuredPrompt, resolveNegativePrompt, STRUCTURED_PROMPT_SCHEMA_DESCRIPTION } from '@/lib/prompt-schema';
import { serializeForVideo } from '@/lib/prompt-serializer';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { VideoModelConfig, getFallbackVideoModel, API_COSTS } from '@/lib/constants';

/**
 * Fetch the video model config for a project. Replicates the pattern from pipeline.worker.ts.
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
 * Fetch scene and keyframes for a given project + segment index.
 * Returns the latest scene version and start/end keyframe assets.
 */
async function fetchSceneAndKeyframes(projectId: string, segIdx: number) {
  // Get the latest script
  const { data: scripts } = await supabase
    .from('script')
    .select('id')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1);

  const scriptId = scripts?.[0]?.id;
  if (!scriptId) return { error: 'No script found for this project' };

  // Get the latest scene version for this segment index
  const { data: scenes } = await supabase
    .from('scene')
    .select('*')
    .eq('script_id', scriptId)
    .eq('segment_index', segIdx)
    .order('version', { ascending: false })
    .limit(1);

  const scene = scenes?.[0];
  if (!scene) return { error: `Scene for segment ${segIdx} not found` };

  // Get keyframe assets for this scene
  const { data: keyframes } = await supabase
    .from('asset')
    .select('id, type, url, status')
    .eq('scene_id', scene.id)
    .in('type', ['keyframe_start', 'keyframe_end'])
    .eq('status', 'completed');

  const startKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_start');
  const endKeyframe = keyframes?.find((a: any) => a.type === 'keyframe_end');

  return { scene, startKeyframe, endKeyframe };
}

/**
 * Generate a StructuredPrompt via LLM (same logic as DirectorAgent.generateVideoPrompt).
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
 * POST /api/projects/[id]/segments/[segIdx]/preview
 *
 * Build and return a full video prompt preview for a segment.
 * Uses video_prompt_override if present, otherwise generates via LLM ($0.01).
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

    // Fetch project to validate it exists and get negative prompt override
    const { data: project, error: projError } = await supabase
      .from('project')
      .select('id, status, negative_prompt_override')
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

    // Fetch scene and keyframes
    const result = await fetchSceneAndKeyframes(id, segIdx);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    const { scene, startKeyframe, endKeyframe } = result;

    // Resolve the StructuredPrompt: use override if valid, else generate via LLM
    let structuredPrompt: StructuredPrompt;
    let generatedFresh = false;

    const promptOverride = scene.video_prompt_override as StructuredPrompt | null;
    if (promptOverride && isStructuredPrompt(promptOverride)) {
      structuredPrompt = promptOverride;
    } else {
      const negativePrompt = resolveNegativePrompt(project, 'directing');
      structuredPrompt = await generateVideoPrompt(scene, segIdx, negativePrompt, vm);
      generatedFresh = true;

      // Track LLM cost
      await supabase.rpc('increment_project_cost', {
        p_project_id: id,
        p_amount: parseFloat(API_COSTS.wavespeedChat.toFixed(4)),
      });
    }

    // Serialize for video
    const shotDuration = String(vm.shot_duration);
    const serialized = serializeForVideo(structuredPrompt, shotDuration);
    const negativePrompt = resolveNegativePrompt(project, 'directing');

    // Log preview event
    await logToGenerationLog(supabase, {
      project_id: id,
      event_type: 'preview_generated',
      agent_name: 'VideoPreview',
      stage: 'casting_review',
      detail: { segmentIndex: segIdx, generatedFresh, sceneId: scene.id },
    });

    return NextResponse.json({
      segmentIndex: segIdx,
      startKeyframe: startKeyframe
        ? { url: startKeyframe.url, assetId: startKeyframe.id }
        : null,
      endKeyframe: endKeyframe
        ? { url: endKeyframe.url, assetId: endKeyframe.id }
        : null,
      structuredPrompt,
      serialized: {
        prompt: serialized.prompt,
        multiPrompt: serialized.multiPrompt,
        negativePrompt: serialized.negativePrompt || negativePrompt,
      },
      config: {
        duration: vm.segment_duration,
        cfgScale: 0.5,
        aspectRatio: vm.aspect_ratio,
        cost: vm.cost_per_segment,
      },
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/segments/[segIdx]/preview' }, 'Error generating preview');
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
