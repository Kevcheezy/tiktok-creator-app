import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';

/**
 * POST /api/projects/[id]/approve
 *
 * Approves the current review stage and enqueues the next pipeline step.
 * - analysis_review -> enqueue 'scripting'
 * - script_review   -> enqueue 'casting'
 * - casting_review  -> enqueue 'directing'
 * - asset_review    -> set status to 'editing' (Phase 4 placeholder)
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
      .select('id, status, product_image_url')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Gate: require product image before progressing past analysis_review
    if (proj.status === 'analysis_review' && !proj.product_image_url) {
      return NextResponse.json(
        { error: 'A product image is required before proceeding. Upload one or verify the extracted image.' },
        { status: 400 }
      );
    }

    // script_review -> influencer_selection (user picks influencer before casting)
    if (proj.status === 'script_review') {
      await supabase
        .from('project')
        .update({ status: 'influencer_selection', updated_at: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({
        message: 'Script approved. Please select an influencer before casting.',
        projectId: id,
        previousStatus: 'script_review',
        nextStep: 'influencer_selection',
      });
    }

    // Map review status to next pipeline step
    const nextStepMap: Record<string, { step: string; jobName: string }> = {
      analysis_review: { step: 'scripting', jobName: 'scripting' },
      casting_review: { step: 'directing', jobName: 'directing' },
    };

    const next = nextStepMap[proj.status];

    if (proj.status === 'asset_review') {
      await getPipelineQueue().add('editing', {
        projectId: id,
        step: 'editing',
      });

      return NextResponse.json({
        message: 'Approved. Enqueued "editing" step.',
        projectId: id,
        previousStatus: proj.status,
        nextStep: 'editing',
      });
    }

    if (!next) {
      return NextResponse.json(
        { error: `Project is not in a review state (current: ${proj.status})` },
        { status: 400 }
      );
    }

    // Enqueue next pipeline step
    await getPipelineQueue().add(next.jobName, {
      projectId: id,
      step: next.step as 'scripting' | 'casting' | 'directing',
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
