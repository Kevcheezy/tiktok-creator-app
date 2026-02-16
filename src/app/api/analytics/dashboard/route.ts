import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  try {
    // 1. Count total completed runs
    const { count: totalRuns, error: countError } = await supabase
      .from('completed_run')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error({ error: countError }, 'Failed to count completed runs');
      return NextResponse.json(
        { error: 'Failed to fetch completed run count' },
        { status: 500 }
      );
    }

    // 2. Fetch all video_performance rows with completed_run join
    const { data: perfRows, error: perfError } = await supabase
      .from('video_performance')
      .select(
        '*, completed_run:completed_run(total_cost_usd, tone, character_name, influencer_name, hook_score, final_video_url)'
      );

    if (perfError) {
      logger.error({ error: perfError }, 'Failed to fetch video performance data');
      return NextResponse.json(
        { error: 'Failed to fetch video performance data' },
        { status: 500 }
      );
    }

    const rows = perfRows ?? [];

    // 3. Aggregate in JS
    const trackedRuns = rows.length;

    const totalRevenue = rows.reduce(
      (sum, row) => sum + (row.gmv_usd ?? 0),
      0
    );

    const totalCost = rows.reduce(
      (sum, row) => sum + (row.completed_run?.total_cost_usd ?? 0),
      0
    );

    const roiValues = rows
      .map((row) => row.roi)
      .filter((roi): roi is number => roi !== null && roi !== undefined);

    const avgRoi =
      roiValues.length > 0
        ? roiValues.reduce((sum, val) => sum + val, 0) / roiValues.length
        : null;

    const totalViews = rows.reduce(
      (sum, row) => sum + (row.views ?? 0),
      0
    );

    // Best and worst performers by ROI
    const rowsWithRoi = rows.filter(
      (row) => row.roi !== null && row.roi !== undefined
    );

    let bestPerformer = null;
    let worstPerformer = null;

    if (rowsWithRoi.length > 0) {
      const sorted = [...rowsWithRoi].sort(
        (a, b) => (b.roi as number) - (a.roi as number)
      );

      const best = sorted[0];
      bestPerformer = {
        id: best.id,
        project_id: best.project_id,
        views: best.views,
        roi: best.roi,
        final_video_url: best.completed_run?.final_video_url ?? null,
      };

      const worst = sorted[sorted.length - 1];
      worstPerformer = {
        id: worst.id,
        project_id: worst.project_id,
        views: worst.views,
        roi: worst.roi,
        final_video_url: worst.completed_run?.final_video_url ?? null,
      };
    }

    // Badge counts
    const badgeCounts = {
      viral: 0,
      converting: 0,
      underperforming: 0,
      unclassified: 0,
    };

    for (const row of rows) {
      const badge = row.performance_badge;
      if (badge === 'viral') {
        badgeCounts.viral++;
      } else if (badge === 'converting') {
        badgeCounts.converting++;
      } else if (badge === 'underperforming') {
        badgeCounts.underperforming++;
      } else {
        badgeCounts.unclassified++;
      }
    }

    return NextResponse.json({
      totalRuns: totalRuns ?? 0,
      trackedRuns,
      totalRevenue,
      totalCost,
      avgRoi,
      totalViews,
      bestPerformer,
      worstPerformer,
      badgeCounts,
    });
  } catch (error) {
    logger.error({ err: error }, 'Unexpected error in analytics dashboard');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
