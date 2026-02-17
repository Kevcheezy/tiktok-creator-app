import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/assets/[assetId]/cancel
 *
 * Cancels a single in-flight asset (test video, regeneration, etc.).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: projectId, assetId } = await params;

  try {
    const { data: asset, error } = await supabase
      .from('asset')
      .select('id, status, project_id')
      .eq('id', assetId)
      .single();

    if (error || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.project_id !== projectId) {
      return NextResponse.json({ error: 'Asset does not belong to this project' }, { status: 400 });
    }

    if (asset.status !== 'generating') {
      return NextResponse.json(
        { error: `Cannot cancel asset with status "${asset.status}". Only generating assets can be cancelled.` },
        { status: 400 }
      );
    }

    await supabase
      .from('asset')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', assetId);

    logger.info(
      { projectId, assetId, route: '/api/projects/[id]/assets/[assetId]/cancel' },
      'Asset cancelled'
    );

    return NextResponse.json({ status: 'cancelled', assetId });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets/[assetId]/cancel' }, 'Error cancelling asset');
    return NextResponse.json(
      { error: 'Failed to cancel asset' },
      { status: 500 }
    );
  }
}
