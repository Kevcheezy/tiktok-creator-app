import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue, type PipelineJobData } from '@/lib/queue';
import { RESTART_STAGE_MAP, REVIEW_GATE_STATUSES } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/retry
 *
 * Two modes:
 * 1. Failed retry (no body or empty body): re-enqueues the failed stage using `failed_at_status`.
 * 2. Stage restart (body: { stage }): restarts a specific pipeline stage from a review gate.
 *    Valid stages: analysis, scripting, casting, directing, voiceover, editing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { stage } = body as { stage?: string };

    const { data: proj, error: fetchError } = await supabase
      .from('project')
      .select('id, status, failed_at_status')
      .eq('id', id)
      .single();

    if (fetchError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Mode 2: Explicit stage restart from a review gate
    if (stage) {
      const mapping = RESTART_STAGE_MAP[stage];
      if (!mapping) {
        return NextResponse.json(
          { error: `Invalid stage '${stage}'. Valid stages: ${Object.keys(RESTART_STAGE_MAP).join(', ')}` },
          { status: 400 }
        );
      }

      const isReviewGate = REVIEW_GATE_STATUSES.includes(proj.status as typeof REVIEW_GATE_STATUSES[number]);
      const isFailed = proj.status === 'failed';

      if (!isReviewGate && !isFailed) {
        return NextResponse.json(
          { error: `Cannot restart: project is in '${proj.status}' status. Restart is only available at review stages or when failed.` },
          { status: 400 }
        );
      }

      await supabase
        .from('project')
        .update({
          status: mapping.targetStatus,
          failed_at_status: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      await getPipelineQueue().add(mapping.queueStep, {
        projectId: id,
        step: mapping.queueStep as PipelineJobData['step'],
      });

      return NextResponse.json({
        message: `Restarting '${stage}' stage.`,
        projectId: id,
        previousStatus: proj.status,
        targetStatus: mapping.targetStatus,
        enqueuedStep: mapping.queueStep,
      });
    }

    // Mode 1: Retry from failed state using failed_at_status
    if (proj.status !== 'failed' || !proj.failed_at_status) {
      return NextResponse.json(
        { error: 'Project is not in a failed state. To restart a specific stage, provide { stage } in the request body.' },
        { status: 400 }
      );
    }

    const failedStep = proj.failed_at_status;

    const stepToJob: Record<string, string> = {
      analyzing: 'product_analysis',
      scripting: 'scripting',
      broll_planning: 'broll_planning',
      broll_generation: 'broll_generation',
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
