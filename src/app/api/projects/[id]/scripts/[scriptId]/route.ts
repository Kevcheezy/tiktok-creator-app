import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/projects/[id]/scripts/[scriptId]
 *
 * Updates grade, feedback, and/or is_favorite on a script.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const { id, scriptId } = await params;

  try {
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields: Record<string, unknown> = {};
    if ('grade' in body) allowedFields.grade = body.grade;
    if ('feedback' in body) allowedFields.feedback = body.feedback;
    if ('is_favorite' in body) allowedFields.is_favorite = body.is_favorite;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: grade, feedback, is_favorite' },
        { status: 400 }
      );
    }

    // Verify the script belongs to this project
    const { data: updated, error } = await supabase
      .from('script')
      .update(allowedFields)
      .eq('id', scriptId)
      .eq('project_id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: 'Script not found for this project' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/scripts/[scriptId]' }, 'Error updating script');
    return NextResponse.json(
      { error: 'Failed to update script' },
      { status: 500 }
    );
  }
}
