import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { REVIEW_GATE_STATUSES, EDITABLE_PROJECT_FIELDS, TONE_IDS } from '@/lib/constants';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proj, error } = await supabase
    .from('project')
    .select('*, character:ai_character(*), script_template:script_template(*), influencer:influencer(*), product:product(*), video_model:video_model(*)')
    .eq('id', id)
    .single();

  if (error || !proj) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(proj);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Fetch current project to check status
    const { data: proj, error: fetchError } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build allowed updates based on current status
    const updates: Record<string, unknown> = {};

    // Settings fields (tone, character, influencer, name) — only at review gates
    for (const field of EDITABLE_PROJECT_FIELDS) {
      if (field in body) {
        if (!REVIEW_GATE_STATUSES.includes(proj.status as typeof REVIEW_GATE_STATUSES[number])) {
          return NextResponse.json(
            { error: `Cannot edit ${field}: project is in '${proj.status}' status. Settings can only be changed at review stages.` },
            { status: 400 }
          );
        }
        // Validate tone if provided
        if (field === 'tone' && body.tone) {
          if (!TONE_IDS.includes(body.tone)) {
            return NextResponse.json(
              { error: `Invalid tone '${body.tone}'. Valid tones: ${TONE_IDS.join(', ')}` },
              { status: 400 }
            );
          }
        }
        updates[field] = body[field];
      }
    }

    // video_model_id — editable at review gates (same rules as tone/character)
    if ('video_model_id' in body) {
      if (!REVIEW_GATE_STATUSES.includes(proj.status as typeof REVIEW_GATE_STATUSES[number])) {
        return NextResponse.json(
          { error: `Cannot change video model: project is in '${proj.status}' status. Video model can only be changed at review stages.` },
          { status: 400 }
        );
      }
      updates.video_model_id = body.video_model_id;
    }

    // Always-allowed fields (internal updates from frontend — product_placement, etc.)
    const ALWAYS_ALLOWED = ['product_placement', 'product_image_url', 'product_data', 'negative_prompt_override', 'fast_mode', 'video_retries', 'scene_override', 'scene_preset_id', 'interaction_override', 'interaction_preset_id'] as const;
    for (const field of ALWAYS_ALLOWED) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('project')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]' }, 'Error updating project');
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error: fetchError } = await supabase
      .from('project')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete related records first (completed_run, generation_log, assets, scenes, scripts)
    await supabase.from('generation_log').delete().eq('project_id', id);
    await supabase.from('completed_run').delete().eq('project_id', id);
    await supabase.from('asset').delete().eq('project_id', id);

    const { data: scripts } = await supabase
      .from('script')
      .select('id')
      .eq('project_id', id);

    if (scripts && scripts.length > 0) {
      const scriptIds = scripts.map((s) => s.id);
      await supabase.from('scene').delete().in('script_id', scriptIds);
      await supabase.from('script').delete().eq('project_id', id);
    }

    const { error } = await supabase
      .from('project')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/projects/[id]' }, 'Error deleting project');
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]' }, 'Error deleting project');
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
