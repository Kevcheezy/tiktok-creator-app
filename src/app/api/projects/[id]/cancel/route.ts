import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const CANCEL_ROLLBACK_MAP: Record<string, string> = {
  analyzing: 'created',
  scripting: 'analysis_review',
  broll_planning: 'script_review',
  casting: 'influencer_selection',
  directing: 'casting_review',
  voiceover: 'casting_review',
  broll_generation: 'casting_review',
  editing: 'asset_review',
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rollbackTo = CANCEL_ROLLBACK_MAP[proj.status];
    if (!rollbackTo) {
      return NextResponse.json(
        { error: `Cannot cancel from status "${proj.status}". Only processing stages can be canceled.` },
        { status: 400 }
      );
    }

    // 1. Set cancel flag so the worker knows to stop
    await supabase
      .from('project')
      .update({
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 2. Flip in-flight and pending assets to cancelled
    await supabase
      .from('asset')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('project_id', id)
      .in('status', ['generating', 'pending']);

    // 3. Roll back project status (leave cancel_requested_at set for worker to consume)
    await supabase
      .from('project')
      .update({
        status: rollbackTo,
        error_message: null,
        failed_at_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    logger.info(
      { projectId: id, from: proj.status, to: rollbackTo, route: '/api/projects/[id]/cancel' },
      'Pipeline hard-cancelled, assets marked cancelled, rolled back to review gate'
    );

    return NextResponse.json({ status: rollbackTo });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/cancel' }, 'Error canceling pipeline');
    return NextResponse.json(
      { error: 'Failed to cancel pipeline stage' },
      { status: 500 }
    );
  }
}
