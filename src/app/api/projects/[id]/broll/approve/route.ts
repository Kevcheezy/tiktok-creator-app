import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/broll/approve
 * Approve the B-roll shot list. Transitions project to influencer_selection.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify project is in broll_review status
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (proj.status !== 'broll_review') {
      return NextResponse.json(
        { error: `Project is not in broll_review status (current: ${proj.status})` },
        { status: 400 }
      );
    }

    // Check that at least some shots exist and are not all removed
    const { data: shots } = await supabase
      .from('broll_shot')
      .select('id')
      .eq('project_id', id)
      .neq('status', 'removed');

    if (!shots || shots.length === 0) {
      return NextResponse.json(
        { error: 'No active B-roll shots to approve. Add at least one shot.' },
        { status: 400 }
      );
    }

    // Transition to influencer_selection
    await supabase
      .from('project')
      .update({ status: 'influencer_selection', updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      message: 'B-roll plan approved. Please select an influencer before casting.',
      projectId: id,
      previousStatus: 'broll_review',
      nextStep: 'influencer_selection',
      shotCount: shots.length,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll/approve' }, 'Error approving B-roll');
    return NextResponse.json({ error: 'Failed to approve B-roll plan' }, { status: 500 });
  }
}
