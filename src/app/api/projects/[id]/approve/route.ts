import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';

/**
 * POST /api/projects/[id]/approve
 *
 * Approves the current review stage and enqueues the next pipeline step.
 * - analysis_review -> enqueue 'scripting'
 * - script_review   -> enqueue 'casting' (future)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch current project status
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Map review status to next pipeline step
    const nextStepMap: Record<string, { step: string; jobName: string }> = {
      analysis_review: { step: 'scripting', jobName: 'scripting' },
      script_review: { step: 'casting', jobName: 'casting' },
    };

    const next = nextStepMap[proj.status];
    if (!next) {
      return NextResponse.json(
        { error: `Project is not in a review state (current: ${proj.status})` },
        { status: 400 }
      );
    }

    // Enqueue next pipeline step
    await getPipelineQueue().add(next.jobName, {
      projectId: id,
      step: next.step as 'scripting' | 'casting',
    });

    return NextResponse.json({
      message: `Approved. Enqueued "${next.step}" step.`,
      projectId: id,
      previousStatus: proj.status,
      nextStep: next.step,
    });
  } catch (error) {
    console.error('Error approving project:', error);
    return NextResponse.json(
      { error: 'Failed to approve project' },
      { status: 500 }
    );
  }
}
