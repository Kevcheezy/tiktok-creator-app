import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * Maps each processing stage to the review gate the user should return to.
 * Pipeline: created → analyzing → analysis_review → scripting → script_review
 *   → broll_planning → broll_review → influencer_selection → casting
 *   → casting_review → directing → voiceover → broll_generation
 *   → asset_review → editing → completed
 */
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

/**
 * POST /api/projects/[id]/cancel
 *
 * Cancels an in-progress pipeline stage and rolls the project back
 * to the previous review gate so the user can make changes and retry.
 */
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
      'Pipeline canceled, rolled back to review gate'
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
