import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[id]/broll
 * List all B-roll shots for a project.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: shots, error } = await supabase
      .from('broll_shot')
      .select('*')
      .eq('project_id', id)
      .order('segment_index')
      .order('shot_index');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(shots || []);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll' }, 'Error listing B-roll shots');
    return NextResponse.json({ error: 'Failed to list B-roll shots' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/broll
 * Add a custom B-roll shot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { segment_index, shot_index, category, prompt, narrative_role, timing_seconds, duration_seconds } = body;

    if (segment_index === undefined || !category || !prompt || timing_seconds === undefined) {
      return NextResponse.json(
        { error: 'Required fields: segment_index, category, prompt, timing_seconds' },
        { status: 400 }
      );
    }

    // Get latest script for project
    const { data: scripts } = await supabase
      .from('script')
      .select('id')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1);

    if (!scripts || scripts.length === 0) {
      return NextResponse.json({ error: 'No script found for project' }, { status: 400 });
    }

    const { data: shot, error } = await supabase
      .from('broll_shot')
      .insert({
        project_id: id,
        script_id: scripts[0].id,
        segment_index,
        shot_index: shot_index ?? 0,
        category,
        prompt,
        narrative_role: narrative_role || '',
        timing_seconds,
        duration_seconds: duration_seconds || 2.5,
        source: 'ai_generated',
        status: 'planned',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(shot, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll' }, 'Error adding B-roll shot');
    return NextResponse.json({ error: 'Failed to add B-roll shot' }, { status: 500 });
  }
}
