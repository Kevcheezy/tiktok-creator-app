import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/archive
 *
 * Snapshots a completed project as an immutable run record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch project with relations
    const { data: project, error: projError } = await supabase
      .from('project')
      .select('*, character:ai_character(name), influencer:influencer(name)')
      .eq('id', id)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'completed') {
      return NextResponse.json(
        { error: 'Project must be completed before archiving' },
        { status: 400 }
      );
    }

    // 2. Fetch the latest script with scenes
    const { data: scripts } = await supabase
      .from('script')
      .select('*, scenes:scene(*)')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const script = scripts?.[0];

    // 3. Fetch all assets
    const { data: assets } = await supabase
      .from('asset')
      .select('type, url, cost_usd')
      .eq('project_id', id)
      .eq('status', 'completed');

    // Build asset URLs map
    const assetUrls: Record<string, string[]> = {};
    let finalVideoUrl = '';
    for (const asset of assets || []) {
      if (asset.type === 'final_video') {
        finalVideoUrl = asset.url || '';
      }
      if (!assetUrls[asset.type]) assetUrls[asset.type] = [];
      if (asset.url) assetUrls[asset.type].push(asset.url);
    }

    // 4. Build script snapshot
    const scriptSnapshot = script ? {
      version: script.version,
      tone: script.tone,
      hook_score: script.hook_score,
      segments: (script.scenes || []).map((s: any) => ({
        segment_index: s.segment_index,
        section: s.section,
        script_text: s.script_text,
        text_overlay: s.text_overlay,
      })),
    } : null;

    // 5. Insert completed_run
    const { data: run, error: insertError } = await supabase
      .from('completed_run')
      .insert({
        project_id: id,
        product_data: project.product_data,
        script_snapshot: scriptSnapshot,
        tone: script?.tone,
        character_name: project.character?.name || null,
        influencer_name: project.influencer?.name || null,
        hook_score: script?.hook_score,
        asset_urls: assetUrls,
        final_video_url: finalVideoUrl,
        total_cost_usd: project.cost_usd,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/archive' }, 'Error archiving project');
    return NextResponse.json(
      { error: 'Failed to archive project' },
      { status: 500 }
    );
  }
}
