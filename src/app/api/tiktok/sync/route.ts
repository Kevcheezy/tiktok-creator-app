import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getValidAccessToken, fetchVideoMetrics } from '@/lib/tiktok';
import {
  computePerformanceBadge,
  computeRoi,
  computeDaysSincePost,
  shouldCreateSnapshot,
} from '@/lib/performance';

export async function POST(request: NextRequest) {
  try {
    let accessToken: string;

    try {
      accessToken = await getValidAccessToken();
    } catch (err: any) {
      if (err?.message === 'NO_TIKTOK_CONNECTION') {
        return NextResponse.json(
          { error: 'TikTok not connected', code: 'NOT_CONNECTED' },
          { status: 401 },
        );
      }
      throw err;
    }

    // Fetch all video_performance rows with tiktok_video_id
    const { data: videos, error: fetchError } = await supabase
      .from('video_performance')
      .select('*, completed_run:completed_run(total_cost_usd, created_at)')
      .not('tiktok_video_id', 'is', null);

    if (fetchError) {
      logger.error({ error: fetchError }, 'Failed to fetch video performance rows');
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ synced: 0, errors: [] });
    }

    // Collect all tiktok video IDs and fetch metrics in batches
    const videoIds = videos.map((v: any) => v.tiktok_video_id);
    const metricsResponse = await fetchVideoMetrics(accessToken, videoIds);

    // Build a map of video_id -> metrics (TikTokVideoMetrics uses `id` field)
    const metricsMap = new Map<string, any>();
    for (const metric of metricsResponse) {
      metricsMap.set(metric.id, metric);
    }

    let successCount = 0;
    const errorVideoIds: string[] = [];

    for (const video of videos) {
      const metrics = metricsMap.get(video.tiktok_video_id);

      if (!metrics) {
        errorVideoIds.push(video.tiktok_video_id);
        continue;
      }

      // Determine data_source
      const hasManualData =
        (video.avg_watch_time_seconds && parseFloat(video.avg_watch_time_seconds) > 0) ||
        (video.completion_rate_pct && parseFloat(video.completion_rate_pct) > 0) ||
        (video.units_sold && video.units_sold > 0) ||
        (video.gmv_usd && parseFloat(video.gmv_usd) > 0) ||
        (video.conversion_rate_pct && parseFloat(video.conversion_rate_pct) > 0) ||
        (video.add_to_cart_rate_pct && parseFloat(video.add_to_cart_rate_pct) > 0);

      const dataSource = hasManualData ? 'mixed' : 'api';

      // Compute ROI using gmv and cost from completed_run
      const totalCost = parseFloat(video.completed_run?.total_cost_usd || '0');
      const gmvUsd = parseFloat(video.gmv_usd || '0');
      const roi = computeRoi(gmvUsd, totalCost);

      // Compute performance badge
      const daysSincePost = computeDaysSincePost(
        video.completed_run?.created_at || video.created_at,
      );
      const badge = computePerformanceBadge({
        views: metrics.view_count || 0,
        conversionRatePct: video.conversion_rate_pct
          ? parseFloat(video.conversion_rate_pct)
          : null,
        gmvUsd,
        roi,
        daysSincePost,
      });

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('video_performance')
        .update({
          views: metrics.view_count || 0,
          likes: metrics.like_count || 0,
          comments: metrics.comment_count || 0,
          shares: metrics.share_count || 0,
          data_source: dataSource,
          roi,
          performance_badge: badge,
          last_synced_at: now,
          updated_at: now,
        })
        .eq('id', video.id);

      if (updateError) {
        logger.error(
          { videoId: video.id, tiktokVideoId: video.tiktok_video_id, error: updateError },
          'Failed to update video performance',
        );
        errorVideoIds.push(video.tiktok_video_id);
        continue;
      }

      // Create snapshot if new calendar day
      if (shouldCreateSnapshot(video.last_synced_at)) {
        const snapshotDays = computeDaysSincePost(
          video.completed_run?.created_at || video.created_at,
        );
        await supabase.from('performance_snapshot').upsert(
          {
            video_performance_id: video.id,
            snapshot_date: new Date().toISOString().split('T')[0],
            days_since_post: snapshotDays,
            views: metrics.view_count || 0,
            likes: metrics.like_count || 0,
            comments: metrics.comment_count || 0,
            shares: metrics.share_count || 0,
            units_sold: video.units_sold || 0,
            gmv_usd: gmvUsd,
          },
          { onConflict: 'video_performance_id,snapshot_date' },
        );
      }

      successCount++;
    }

    return NextResponse.json({
      synced: successCount,
      errors: errorVideoIds,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'TikTok sync failed');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
