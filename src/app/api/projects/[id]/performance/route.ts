import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { extractVideoId } from '@/lib/tiktok';
import {
  computePerformanceBadge,
  computeRoi,
  computeDaysSincePost,
  shouldCreateSnapshot,
} from '@/lib/performance';

// ─── POST — Create performance record ────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Verify project has a completed_run
    const { data: run, error: runError } = await supabase
      .from('completed_run')
      .select('id, total_cost_usd, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Project must be archived before tracking performance' },
        { status: 400 },
      );
    }

    // Check if performance record already exists
    const { data: existing } = await supabase
      .from('video_performance')
      .select('id')
      .eq('completed_run_id', run.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Performance record already exists. Use PATCH to update.' },
        { status: 409 },
      );
    }

    // Extract video ID from URL
    const tiktokVideoId = body.tiktok_post_url
      ? extractVideoId(body.tiktok_post_url)
      : null;

    // Compute derived fields
    const totalCost = parseFloat(run.total_cost_usd || '0');
    const gmvUsd = body.gmv_usd || 0;
    const roi = computeRoi(gmvUsd, totalCost);
    const daysSincePost = computeDaysSincePost(run.created_at);
    const badge = computePerformanceBadge({
      views: body.views || 0,
      conversionRatePct: body.conversion_rate_pct ?? null,
      gmvUsd,
      roi,
      daysSincePost,
    });

    const { data: perf, error: insertError } = await supabase
      .from('video_performance')
      .insert({
        completed_run_id: run.id,
        project_id: id,
        tiktok_post_url: body.tiktok_post_url || null,
        tiktok_video_id: tiktokVideoId,
        views: body.views || 0,
        likes: body.likes || 0,
        comments: body.comments || 0,
        shares: body.shares || 0,
        avg_watch_time_seconds: body.avg_watch_time_seconds ?? null,
        completion_rate_pct: body.completion_rate_pct ?? null,
        units_sold: body.units_sold || 0,
        gmv_usd: gmvUsd,
        conversion_rate_pct: body.conversion_rate_pct ?? null,
        add_to_cart_rate_pct: body.add_to_cart_rate_pct ?? null,
        roi,
        performance_badge: badge,
        data_source: 'manual',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info({ projectId: id, performanceId: perf.id }, 'Performance record created');
    return NextResponse.json(perf, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/performance', method: 'POST' }, 'Error creating performance record');
    return NextResponse.json({ error: 'Failed to create performance record' }, { status: 500 });
  }
}

// ─── GET — Read performance + snapshots ──────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { data: perf } = await supabase
      .from('video_performance')
      .select('*')
      .eq('project_id', id)
      .single();

    if (!perf) {
      return NextResponse.json({ performance: null, snapshots: [], completedRun: null });
    }

    // Fetch snapshots
    const { data: snapshots } = await supabase
      .from('performance_snapshot')
      .select('*')
      .eq('video_performance_id', perf.id)
      .order('snapshot_date', { ascending: true });

    // Fetch linked completed_run
    const { data: completedRun } = await supabase
      .from('completed_run')
      .select('*')
      .eq('id', perf.completed_run_id)
      .single();

    return NextResponse.json({
      performance: perf,
      snapshots: snapshots || [],
      completedRun,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/performance', method: 'GET' }, 'Error fetching performance');
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}

// ─── PATCH — Update metrics ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Fetch existing performance record
    const { data: perf, error: fetchError } = await supabase
      .from('video_performance')
      .select('*, completed_run:completed_run(total_cost_usd, created_at)')
      .eq('project_id', id)
      .single();

    if (fetchError || !perf) {
      return NextResponse.json({ error: 'No performance record found' }, { status: 404 });
    }

    // Build update object from provided fields
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const fields = [
      'tiktok_post_url', 'views', 'likes', 'comments', 'shares',
      'avg_watch_time_seconds', 'completion_rate_pct', 'units_sold',
      'gmv_usd', 'conversion_rate_pct', 'add_to_cart_rate_pct',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Re-extract video ID if URL changed
    if (body.tiktok_post_url !== undefined) {
      updateData.tiktok_video_id = body.tiktok_post_url
        ? extractVideoId(body.tiktok_post_url)
        : null;
    }

    // Recompute ROI and badge
    const totalCost = parseFloat(perf.completed_run?.total_cost_usd || '0');
    const gmvUsd = (updateData.gmv_usd as number) ?? perf.gmv_usd ?? 0;
    const roi = computeRoi(Number(gmvUsd), totalCost);
    const daysSincePost = computeDaysSincePost(perf.completed_run?.created_at || perf.created_at);

    const badge = computePerformanceBadge({
      views: Number((updateData.views as number) ?? perf.views ?? 0),
      conversionRatePct: ((updateData.conversion_rate_pct as number) ?? perf.conversion_rate_pct) || null,
      gmvUsd: Number(gmvUsd),
      roi,
      daysSincePost,
    });

    updateData.roi = roi;
    updateData.performance_badge = badge;

    // Determine data_source
    if (perf.data_source === 'api' || perf.last_synced_at) {
      updateData.data_source = 'mixed';
    }

    const { data: updated, error: updateError } = await supabase
      .from('video_performance')
      .update(updateData)
      .eq('id', perf.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create snapshot if new calendar day
    const { data: lastSnapshot } = await supabase
      .from('performance_snapshot')
      .select('snapshot_date')
      .eq('video_performance_id', perf.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (shouldCreateSnapshot(lastSnapshot?.snapshot_date || null)) {
      const snapshotDays = computeDaysSincePost(perf.completed_run?.created_at || perf.created_at);
      await supabase.from('performance_snapshot').upsert(
        {
          video_performance_id: perf.id,
          snapshot_date: new Date().toISOString().split('T')[0],
          days_since_post: snapshotDays,
          views: updated.views,
          likes: updated.likes,
          comments: updated.comments,
          shares: updated.shares,
          units_sold: updated.units_sold,
          gmv_usd: updated.gmv_usd,
        },
        { onConflict: 'video_performance_id,snapshot_date' },
      );
    }

    logger.info({ projectId: id, performanceId: perf.id }, 'Performance record updated');
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/performance', method: 'PATCH' }, 'Error updating performance');
    return NextResponse.json({ error: 'Failed to update performance data' }, { status: 500 });
  }
}
