import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/projects/[id]/broll/[shotId]
 * Edit a B-roll shot (prompt, category, timing, duration, narrative_role).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> }
) {
  const { id, shotId } = await params;

  try {
    const body = await request.json();

    // Whitelist editable fields
    const allowedFields = ['category', 'prompt', 'narrative_role', 'timing_seconds', 'duration_seconds'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: shot, error } = await supabase
      .from('broll_shot')
      .update(updates)
      .eq('id', shotId)
      .eq('project_id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!shot) {
      return NextResponse.json({ error: 'B-roll shot not found' }, { status: 404 });
    }

    return NextResponse.json(shot);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll/[shotId]' }, 'Error updating B-roll shot');
    return NextResponse.json({ error: 'Failed to update B-roll shot' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/broll/[shotId]
 * Remove a B-roll shot.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> }
) {
  const { id, shotId } = await params;

  try {
    const { error } = await supabase
      .from('broll_shot')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', shotId)
      .eq('project_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'B-roll shot removed' });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll/[shotId]' }, 'Error removing B-roll shot');
    return NextResponse.json({ error: 'Failed to remove B-roll shot' }, { status: 500 });
  }
}
