import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/rollback
 * Rolls back a failed project to the previous review gate.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status, failed_at_status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (proj.status !== 'failed' || !proj.failed_at_status) {
      return NextResponse.json(
        { error: 'Project is not in a failed state' },
        { status: 400 }
      );
    }

    // Map failed stage to previous review gate
    const rollbackMap: Record<string, string> = {
      analyzing: 'created',
      scripting: 'analysis_review',
      casting: 'influencer_selection',
      directing: 'casting_review',
      voiceover: 'casting_review',
      editing: 'asset_review',
    };

    const rollbackTo = rollbackMap[proj.failed_at_status];
    if (!rollbackTo) {
      return NextResponse.json(
        { error: `Unknown failed stage: ${proj.failed_at_status}` },
        { status: 400 }
      );
    }

    await supabase
      .from('project')
      .update({
        status: rollbackTo,
        failed_at_status: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      message: `Rolled back to "${rollbackTo}"`,
      projectId: id,
      rolledBackTo: rollbackTo,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/rollback' }, 'Error rolling back project');
    return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 });
  }
}
