import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/assets/regenerate
 *
 * Regenerates a single asset by marking it as 'generating' and
 * enqueuing a targeted regeneration job in BullMQ.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { assetId } = await request.json();

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

    // Verify asset belongs to this project
    const { data: asset, error: fetchError } = await supabase
      .from('asset')
      .select('id, type, status')
      .eq('id', assetId)
      .eq('project_id', id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Only allow regenerating failed, rejected, or completed assets
    if (!['failed', 'rejected', 'completed'].includes(asset.status)) {
      return NextResponse.json(
        { error: 'Can only regenerate failed, rejected, or completed assets' },
        { status: 400 }
      );
    }

    // Mark as generating
    await supabase
      .from('asset')
      .update({ status: 'generating', url: null, updated_at: new Date().toISOString() })
      .eq('id', assetId);

    // Enqueue regeneration job
    await getPipelineQueue().add('regenerate_asset', {
      projectId: id,
      assetId,
      step: 'regenerate_asset',
    });

    return NextResponse.json({ message: 'Regeneration started', assetId });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets/regenerate' }, 'Error starting regeneration');
    return NextResponse.json({ error: 'Failed to start regeneration' }, { status: 500 });
  }
}
