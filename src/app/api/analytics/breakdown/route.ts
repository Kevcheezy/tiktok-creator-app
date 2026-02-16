import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const VALID_DIMENSIONS = ['tone', 'category', 'influencer', 'hook_score'] as const;
type Dimension = (typeof VALID_DIMENSIONS)[number];

function getGroupKey(row: any, dimension: Dimension): string {
  switch (dimension) {
    case 'tone':
      return row.completed_run?.tone ?? 'unknown';
    case 'category':
      return (row.completed_run?.product_data as any)?.category || 'unknown';
    case 'influencer':
      return row.completed_run?.influencer_name || 'No influencer';
    case 'hook_score': {
      const score = row.completed_run?.hook_score;
      if (score === null || score === undefined) return 'Unknown';
      if (score <= 7) return 'Low (0-7)';
      if (score <= 10) return 'Medium (8-10)';
      return 'High (11-14)';
    }
  }
}

interface GroupData {
  key: string;
  count: number;
  totalViews: number;
  totalRoi: number;
  roiCount: number;
  totalGmv: number;
  totalConversionRate: number;
  conversionRateCount: number;
  topPerformer: any | null;
  topPerformerViews: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const dimension = searchParams.get('dimension') as Dimension | null;

    // 1. Validate dimension param
    if (!dimension || !VALID_DIMENSIONS.includes(dimension)) {
      return NextResponse.json(
        {
          error: `Invalid or missing dimension. Must be one of: ${VALID_DIMENSIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 2. Fetch all video_performance with completed_run
    const { data: rows, error } = await supabase
      .from('video_performance')
      .select(
        '*, completed_run:completed_run(tone, influencer_name, hook_score, product_data, total_cost_usd)'
      );

    if (error) {
      logger.error({ error }, 'Failed to fetch video performance for breakdown');
      return NextResponse.json(
        { error: 'Failed to fetch video performance data' },
        { status: 500 }
      );
    }

    const data = rows ?? [];

    // 3. Group by dimension
    const groupMap = new Map<string, GroupData>();

    for (const row of data) {
      const key = getGroupKey(row, dimension);

      let group = groupMap.get(key);
      if (!group) {
        group = {
          key,
          count: 0,
          totalViews: 0,
          totalRoi: 0,
          roiCount: 0,
          totalGmv: 0,
          totalConversionRate: 0,
          conversionRateCount: 0,
          topPerformer: null,
          topPerformerViews: -1,
        };
        groupMap.set(key, group);
      }

      group.count++;
      group.totalViews += row.views ?? 0;
      group.totalGmv += row.gmv_usd ?? 0;

      if (row.roi !== null && row.roi !== undefined) {
        group.totalRoi += row.roi;
        group.roiCount++;
      }

      if (
        row.conversion_rate_pct !== null &&
        row.conversion_rate_pct !== undefined
      ) {
        group.totalConversionRate += row.conversion_rate_pct;
        group.conversionRateCount++;
      }

      const views = row.views ?? 0;
      if (views > group.topPerformerViews) {
        group.topPerformerViews = views;
        group.topPerformer = row;
      }
    }

    // 4. Compute per-group stats and sort by count descending
    const groups = Array.from(groupMap.values())
      .map((group) => ({
        key: group.key,
        count: group.count,
        avgViews:
          group.count > 0
            ? Math.round(group.totalViews / group.count)
            : 0,
        avgRoi:
          group.roiCount > 0 ? group.totalRoi / group.roiCount : null,
        totalGmv: group.totalGmv,
        avgConversionRate:
          group.conversionRateCount > 0
            ? group.totalConversionRate / group.conversionRateCount
            : null,
        topPerformer: group.topPerformer,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ dimension, groups });
  } catch (error) {
    logger.error({ err: error }, 'Unexpected error in analytics breakdown');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
