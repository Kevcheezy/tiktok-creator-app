import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/select-influencer
 *
 * Confirms the influencer selection and enqueues casting.
 * Only valid when project status is 'influencer_selection'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { influencerId, productPlacement } = body;

    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      );
    }

    // Verify project is in the right status
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (proj.status !== 'influencer_selection') {
      return NextResponse.json(
        { error: `Project is not awaiting influencer selection (current: ${proj.status})` },
        { status: 400 }
      );
    }

    // Verify the influencer exists and has a reference image
    const { data: influencer, error: infError } = await supabase
      .from('influencer')
      .select('id, name, image_url')
      .eq('id', influencerId)
      .single();

    if (infError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    if (!influencer.image_url) {
      return NextResponse.json(
        { error: `Influencer "${influencer.name}" has no reference image. Upload one before casting.` },
        { status: 400 }
      );
    }

    // Set influencer and product placement on the project
    const updateData: Record<string, unknown> = {
      influencer_id: influencerId,
      updated_at: new Date().toISOString(),
    };
    if (productPlacement && Array.isArray(productPlacement)) {
      updateData.product_placement = productPlacement;
    }
    await supabase
      .from('project')
      .update(updateData)
      .eq('id', id);

    // Enqueue casting
    await getPipelineQueue().add('casting', {
      projectId: id,
      step: 'casting',
    });

    return NextResponse.json({
      message: `Influencer "${influencer.name}" selected. Casting enqueued.`,
      projectId: id,
      influencerId,
      nextStep: 'casting',
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/select-influencer' }, 'Error selecting influencer');
    return NextResponse.json(
      { error: 'Failed to select influencer' },
      { status: 500 }
    );
  }
}
