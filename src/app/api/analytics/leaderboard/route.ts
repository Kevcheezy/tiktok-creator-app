import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const SORT_COLUMN_MAP: Record<string, string> = {
  views: 'views',
  gmv: 'gmv_usd',
  roi: 'roi',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Parse and validate sort param
    const sortParam = searchParams.get('sort') ?? 'views';
    const sortColumn = SORT_COLUMN_MAP[sortParam];

    if (!sortColumn) {
      return NextResponse.json(
        { error: `Invalid sort param. Must be one of: ${Object.keys(SORT_COLUMN_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Parse and validate limit param
    const limitParam = searchParams.get('limit');
    let limit = 10;

    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'Limit must be a positive integer' },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, 50);
    }

    const { data, error } = await supabase
      .from('video_performance')
      .select(
        '*, completed_run:completed_run(tone, character_name, influencer_name, hook_score, total_cost_usd, final_video_url, created_at, product_data)'
      )
      .order(sortColumn, { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      logger.error({ error }, 'Failed to fetch leaderboard data');
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    logger.error({ err: error }, 'Unexpected error in analytics leaderboard');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
