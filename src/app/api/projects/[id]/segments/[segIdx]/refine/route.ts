import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger, logToGenerationLog } from '@/lib/logger';
import { StructuredPrompt, isStructuredPrompt, resolveNegativePrompt, STRUCTURED_PROMPT_SCHEMA_DESCRIPTION } from '@/lib/prompt-schema';
import { serializeForVideo } from '@/lib/prompt-serializer';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { VideoModelConfig, getFallbackVideoModel, API_COSTS } from '@/lib/constants';

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
 * POST /api/projects/[id]/segments/[segIdx]/refine
 *
 * Re-run LLM with user feedback to produce a new StructuredPrompt.
 * Saves result to scene.video_prompt_override.
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

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const { feedback } = body as { feedback?: string };

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return NextResponse.json({ error: 'feedback is required and must be a non-empty string' }, { status: 400 });
    }

    // Fetch project
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

    const negativePrompt = resolveNegativePrompt(project, 'directing');

    // Get current StructuredPrompt (from override or generate fresh)
    let currentPrompt: StructuredPrompt;
    const promptOverride = scene.video_prompt_override as StructuredPrompt | null;
    if (promptOverride && isStructuredPrompt(promptOverride)) {
      currentPrompt = promptOverride;
    } else {
      currentPrompt = await generateVideoPrompt(scene, segIdx, negativePrompt, vm);
      // Track cost for fresh generation
      await supabase.rpc('increment_project_cost', {
        p_project_id: id,
        p_amount: parseFloat(API_COSTS.wavespeedChat.toFixed(4)),
      });
    }

    // Call LLM with current prompt + user feedback to produce refined prompt
    const wavespeed = new WaveSpeedClient();

    const systemPrompt = `You are a video prompt engineer. Here is the current StructuredPrompt for a Kling 3.0 Pro video segment. The user wants changes. Output an updated StructuredPrompt JSON incorporating their feedback.

${STRUCTURED_PROMPT_SCHEMA_DESCRIPTION}

Output ONLY valid JSON matching the StructuredPrompt schema. Keep all fields that the user did not mention unchanged.`;

    const userPrompt = `Current StructuredPrompt:
${JSON.stringify(currentPrompt, null, 2)}

Scene context:
- Segment ${segIdx} (${scene.section || 'unknown'})
- Script: ${scene.script_text || 'N/A'}
- Duration: ${vm.segment_duration}s

USER FEEDBACK: ${feedback.trim()}

Generate an updated StructuredPrompt that addresses the feedback while keeping other elements intact.`;

    const response = await wavespeed.chatCompletion(systemPrompt, userPrompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const refinedPrompt = JSON.parse(cleaned) as StructuredPrompt;

    // Validate the refined prompt
    if (!isStructuredPrompt(refinedPrompt)) {
      return NextResponse.json(
        { error: 'LLM returned an invalid StructuredPrompt. Please try again with different feedback.' },
        { status: 500 }
      );
    }

    // Save to scene.video_prompt_override
    await supabase
      .from('scene')
      .update({
        video_prompt_override: refinedPrompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scene.id);

    // Track LLM cost for the refinement call
    await supabase.rpc('increment_project_cost', {
      p_project_id: id,
      p_amount: parseFloat(API_COSTS.wavespeedChat.toFixed(4)),
    });

    // Serialize for video
    const shotDuration = String(vm.shot_duration);
    const serialized = serializeForVideo(refinedPrompt, shotDuration);

    // Log refinement event
    await logToGenerationLog(supabase, {
      project_id: id,
      event_type: 'prompt_refined',
      agent_name: 'VideoPreview',
      stage: 'casting_review',
      detail: { segmentIndex: segIdx, sceneId: scene.id, feedback: feedback.trim() },
    });

    return NextResponse.json({
      segmentIndex: segIdx,
      startKeyframe: startKeyframe
        ? { url: startKeyframe.url, assetId: startKeyframe.id }
        : null,
      endKeyframe: endKeyframe
        ? { url: endKeyframe.url, assetId: endKeyframe.id }
        : null,
      structuredPrompt: refinedPrompt,
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
    logger.error({ err: error, route: '/api/projects/[id]/segments/[segIdx]/refine' }, 'Error refining prompt');
    return NextResponse.json(
      { error: 'Failed to refine prompt' },
      { status: 500 }
    );
  }
}
