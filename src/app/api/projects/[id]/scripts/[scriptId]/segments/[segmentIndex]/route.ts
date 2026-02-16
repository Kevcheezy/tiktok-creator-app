import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { countTextSyllables } from '@/lib/syllables';
import { INTERACTION_TYPES, CAMERA_ANGLES, CAMERA_MOVEMENTS, LIGHTING_DIRECTIONS } from '@/lib/constants';
import { logger } from '@/lib/logger';

// PATCH /api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]
// Body: { script_text?, text_overlay?, props_needed?, interaction_type?, camera_specs? }
// Creates a new versioned scene row (per-segment history)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string; segmentIndex: string }> }
) {
  const { id, scriptId, segmentIndex: segmentIndexStr } = await params;
  const segmentIndex = parseInt(segmentIndexStr, 10);

  if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex > 3) {
    return NextResponse.json(
      { error: 'segmentIndex must be 0-3' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    // Validate at least one field to update
    const hasScriptText = 'script_text' in body && typeof body.script_text === 'string';
    const hasTextOverlay = 'text_overlay' in body && typeof body.text_overlay === 'string';
    const hasPropsNeeded = 'props_needed' in body && Array.isArray(body.props_needed);
    const hasInteractionType = 'interaction_type' in body && typeof body.interaction_type === 'string';
    const hasCameraSpecs = 'camera_specs' in body && typeof body.camera_specs === 'object' && body.camera_specs !== null;

    if (!hasScriptText && !hasTextOverlay && !hasPropsNeeded && !hasInteractionType && !hasCameraSpecs) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: script_text, text_overlay, props_needed, interaction_type, camera_specs' },
        { status: 400 }
      );
    }

    // Validate enum values
    if (hasInteractionType) {
      const validTypes: readonly string[] = INTERACTION_TYPES;
      if (!validTypes.includes(body.interaction_type)) {
        return NextResponse.json(
          { error: `Invalid interaction_type. Must be one of: ${INTERACTION_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    if (hasCameraSpecs) {
      const { angle, movement, lighting } = body.camera_specs;
      const validAngles: readonly string[] = CAMERA_ANGLES;
      const validMovements: readonly string[] = CAMERA_MOVEMENTS;
      const validLighting: readonly string[] = LIGHTING_DIRECTIONS;

      if (angle && !validAngles.includes(angle)) {
        return NextResponse.json(
          { error: `Invalid camera angle. Must be one of: ${CAMERA_ANGLES.join(', ')}` },
          { status: 400 }
        );
      }
      if (movement && !validMovements.includes(movement)) {
        return NextResponse.json(
          { error: `Invalid camera movement. Must be one of: ${CAMERA_MOVEMENTS.join(', ')}` },
          { status: 400 }
        );
      }
      if (lighting && !validLighting.includes(lighting)) {
        return NextResponse.json(
          { error: `Invalid lighting direction. Must be one of: ${LIGHTING_DIRECTIONS.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Verify script belongs to project
    const { data: script, error: scriptError } = await supabase
      .from('script')
      .select('id')
      .eq('id', scriptId)
      .eq('project_id', id)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    // Get the current latest scene for this segment
    const { data: currentScene, error: currentError } = await supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .eq('segment_index', segmentIndex)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (currentError || !currentScene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // INSERT new versioned row with edits applied
    const newVersion = (currentScene.version ?? 1) + 1;

    // Merge camera_specs: allow partial updates (e.g., just angle) without losing movement/lighting
    let mergedCameraSpecs = currentScene.camera_specs;
    if (hasCameraSpecs) {
      mergedCameraSpecs = { ...(currentScene.camera_specs || {}), ...body.camera_specs };
    }

    const { data: newScene, error: insertError } = await supabase
      .from('scene')
      .insert({
        script_id: scriptId,
        segment_index: segmentIndex,
        section: currentScene.section,
        script_text: hasScriptText ? body.script_text : currentScene.script_text,
        syllable_count: hasScriptText ? countTextSyllables(body.script_text) : currentScene.syllable_count,
        energy_arc: currentScene.energy_arc,
        shot_scripts: currentScene.shot_scripts,
        audio_sync: currentScene.audio_sync,
        text_overlay: hasTextOverlay ? body.text_overlay : currentScene.text_overlay,
        product_visibility: currentScene.product_visibility,
        props_needed: hasPropsNeeded ? body.props_needed : currentScene.props_needed,
        interaction_type: hasInteractionType ? body.interaction_type : currentScene.interaction_type,
        camera_specs: mergedCameraSpecs,
        tone: currentScene.tone,
        version: newVersion,
      })
      .select()
      .single();

    if (insertError || !newScene) {
      return NextResponse.json(
        { error: 'Failed to create scene version' },
        { status: 500 }
      );
    }

    // Recalculate script.full_text from latest version of each segment
    const { data: allScenes } = await supabase
      .from('scene')
      .select('segment_index, script_text, version')
      .eq('script_id', scriptId)
      .order('segment_index')
      .order('version', { ascending: false });

    if (allScenes) {
      const latest = new Map<number, string>();
      for (const s of allScenes) {
        if (!latest.has(s.segment_index)) {
          latest.set(s.segment_index, s.script_text);
        }
      }
      const newFullText = Array.from(latest.entries())
        .sort(([a], [b]) => a - b)
        .map(([, text]) => text)
        .join('\n\n');
      await supabase.from('script').update({ full_text: newFullText }).eq('id', scriptId);
    }

    return NextResponse.json(newScene);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]' }, 'Error editing segment');
    return NextResponse.json(
      { error: 'Failed to edit segment' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]
// Returns version history for a specific segment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string; segmentIndex: string }> }
) {
  const { id, scriptId, segmentIndex: segmentIndexStr } = await params;
  const segmentIndex = parseInt(segmentIndexStr, 10);

  if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex > 3) {
    return NextResponse.json(
      { error: 'segmentIndex must be 0-3' },
      { status: 400 }
    );
  }

  try {
    // Verify script belongs to project
    const { data: script, error: scriptError } = await supabase
      .from('script')
      .select('id')
      .eq('id', scriptId)
      .eq('project_id', id)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    // Get all versions of this segment
    const { data: versions, error } = await supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .eq('segment_index', segmentIndex)
      .order('version', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch segment history' },
        { status: 500 }
      );
    }

    return NextResponse.json(versions || []);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/[scriptId]/segments/[segmentIndex]' }, 'Error fetching segment history');
    return NextResponse.json(
      { error: 'Failed to fetch segment history' },
      { status: 500 }
    );
  }
}
