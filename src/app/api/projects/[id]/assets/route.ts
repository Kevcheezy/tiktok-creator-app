import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

interface AssetWithScene {
  id: string;
  project_id: string;
  scene_id: string;
  type: string;
  url: string | null;
  status: string;
  provider: string | null;
  cost_usd: string | null;
  grade: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  scene: { segment_index: number; section: string } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: assets, error } = await supabase
      .from('asset')
      .select('*, scene:scene(segment_index, section)')
      .eq('project_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error({ err: error, route: '/api/projects/[id]/assets' }, 'Error fetching assets');
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    const typedAssets = (assets || []) as AssetWithScene[];

    const bySegment: Record<number, AssetWithScene[]> = {};
    for (const asset of typedAssets) {
      const idx = asset.scene?.segment_index ?? -1;
      if (!bySegment[idx]) bySegment[idx] = [];
      bySegment[idx].push(asset);
    }

    return NextResponse.json({ assets: typedAssets, bySegment });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets' }, 'Error fetching assets');
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { assetId, grade, action } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: 'assetId is required' },
        { status: 400 }
      );
    }

    // Verify asset belongs to this project
    const { data: asset, error: fetchError } = await supabase
      .from('asset')
      .select('id, status')
      .eq('id', assetId)
      .eq('project_id', id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json(
        { error: 'Asset not found for this project' },
        { status: 404 }
      );
    }

    if (action === 'reject') {
      const { data: updated, error } = await supabase
        .from('asset')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', assetId)
        .select()
        .single();

      if (error) {
        logger.error({ err: error, route: '/api/projects/[id]/assets' }, 'Error rejecting asset');
        return NextResponse.json({ error: 'Failed to reject asset' }, { status: 500 });
      }

      return NextResponse.json(updated);
    }

    if (!grade) {
      return NextResponse.json(
        { error: 'grade or action is required' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('asset')
      .update({ grade, updated_at: new Date().toISOString() })
      .eq('id', assetId)
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/projects/[id]/assets' }, 'Error grading asset');
      return NextResponse.json({ error: 'Failed to grade asset' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets' }, 'Error updating asset');
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}
