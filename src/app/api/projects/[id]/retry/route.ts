import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/retry
 * Re-enqueues the failed pipeline stage for another attempt.
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

    const failedStep = proj.failed_at_status;

    // Map failed_at_status to BullMQ job name
    const stepToJob: Record<string, string> = {
      analyzing: 'product_analysis',
      scripting: 'scripting',
      casting: 'casting',
      directing: 'directing',
      voiceover: 'voiceover',
      editing: 'editing',
    };

    const jobName = stepToJob[failedStep];
    if (!jobName) {
      return NextResponse.json(
        { error: `Unknown failed stage: ${failedStep}` },
        { status: 400 }
      );
    }

    // Clear error state and re-enqueue
    await supabase
      .from('project')
      .update({
        status: failedStep,
        failed_at_status: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await getPipelineQueue().add(jobName, {
      projectId: id,
      step: jobName === 'product_analysis' ? 'product_analysis' : failedStep,
    });

    return NextResponse.json({
      message: `Retrying "${failedStep}" stage`,
      projectId: id,
      retryStep: failedStep,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/retry' }, 'Error retrying project');
    return NextResponse.json({ error: 'Failed to retry' }, { status: 500 });
  }
}
