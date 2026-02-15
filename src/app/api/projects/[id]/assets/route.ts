import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

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
      console.error('Error fetching assets:', error);
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
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}
