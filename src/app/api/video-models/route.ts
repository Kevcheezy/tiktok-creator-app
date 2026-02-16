import { NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/video-models
 * Returns active video models for the project creation form.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('video_model')
      .select('*')
      .eq('status', 'active')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      logger.error({ err: error, route: '/api/video-models' }, 'Error fetching video models');
      return NextResponse.json({ error: 'Failed to fetch video models' }, { status: 500 });
    }

    return NextResponse.json({ videoModels: data || [] });
  } catch (error) {
    logger.error({ err: error, route: '/api/video-models' }, 'Error fetching video models');
    return NextResponse.json({ error: 'Failed to fetch video models' }, { status: 500 });
  }
}
