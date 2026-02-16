import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

// Stages that allow re-selecting influencer / scene / interaction and re-casting
const RECASTABLE_STATUSES = [
  'influencer_selection',
  'casting',
  'casting_review',
  'directing',
  'voiceover',
  'broll_generation',
  'asset_review',
  'editing',
  'completed',
  'failed',
];

/**
 * POST /api/projects/[id]/select-influencer
 *
 * Confirms the influencer selection and enqueues casting.
 * Allowed from influencer_selection or any downstream stage (re-cast).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { influencerId, productPlacement, scenePresetId, sceneOverride, interactionPresetId, interactionOverride } = body;

    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      );
    }

    // Verify project is in the right status and has product image
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id, status, product_image_url')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!RECASTABLE_STATUSES.includes(proj.status)) {
      return NextResponse.json(
        { error: `Cannot re-cast from status "${proj.status}". Project must be past influencer selection.` },
        { status: 400 }
      );
    }

    if (!proj.product_image_url) {
      return NextResponse.json(
        { error: 'A product image is required before casting. Upload one on the analysis review page.' },
        { status: 400 }
      );
    }

    // Verify the influencer exists and has a reference image + voice
    const { data: influencer, error: infError } = await supabase
      .from('influencer')
      .select('id, name, image_url, voice_id')
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

    if (!influencer.voice_id) {
      return NextResponse.json(
        { error: 'Influencer has no designed voice. Design a voice from the Influencer page first.' },
        { status: 400 }
      );
    }

    // Set influencer, product placement, and scene/interaction on the project
    const updateData: Record<string, unknown> = {
      influencer_id: influencerId,
      updated_at: new Date().toISOString(),
    };
    if (productPlacement && Array.isArray(productPlacement)) {
      updateData.product_placement = productPlacement;
    }

    // Scene preset: explicit selection > default
    if (sceneOverride && typeof sceneOverride === 'string') {
      updateData.scene_override = sceneOverride.trim();
      updateData.scene_preset_id = scenePresetId || null;
    } else if (scenePresetId) {
      updateData.scene_preset_id = scenePresetId;
      updateData.scene_override = null;
    } else {
      // Default to the is_default scene preset
      const { data: defaultScene } = await supabase
        .from('scene_preset')
        .select('id')
        .eq('is_default', true)
        .limit(1)
        .single();
      if (defaultScene) {
        updateData.scene_preset_id = defaultScene.id;
      }
    }

    // Interaction preset: explicit selection > default
    if (interactionOverride && typeof interactionOverride === 'string') {
      updateData.interaction_override = interactionOverride.trim();
      updateData.interaction_preset_id = interactionPresetId || null;
    } else if (interactionPresetId) {
      updateData.interaction_preset_id = interactionPresetId;
      updateData.interaction_override = null;
    } else {
      // Default to the is_default interaction preset
      const { data: defaultInteraction } = await supabase
        .from('interaction_preset')
        .select('id')
        .eq('is_default', true)
        .limit(1)
        .single();
      if (defaultInteraction) {
        updateData.interaction_preset_id = defaultInteraction.id;
      }
    }

    // Always advance to casting status
    updateData.status = 'casting';

    // Clear error state when re-casting from a failed/downstream stage
    if (proj.status !== 'influencer_selection') {
      updateData.error_message = null;
      updateData.failed_at_status = null;
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
