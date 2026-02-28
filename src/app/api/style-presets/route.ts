import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * GET /api/style-presets
 *
 * Returns all style presets ordered by created_at DESC.
 * Optional ?category=supplements to filter by categories array (@> operator).
 */
export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');

    let query = supabase
      .from('style_preset')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.contains('categories', [category]);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ err: error, route: '/api/style-presets' }, 'Error fetching style presets');
      return NextResponse.json({ error: 'Failed to fetch style presets' }, { status: 500 });
    }

    return NextResponse.json({ presets: data || [] });
  } catch (err) {
    logger.error({ err, route: '/api/style-presets' }, 'Error fetching style presets');
    return NextResponse.json({ error: 'Failed to fetch style presets' }, { status: 500 });
  }
}

/**
 * POST /api/style-presets
 *
 * Creates a new style preset and enqueues analysis.
 * Body: { name: string, videoUrl: string, categories?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, videoUrl, categories } = body as {
      name?: string;
      videoUrl?: string;
      categories?: string[];
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
    }

    const { data: preset, error } = await supabase
      .from('style_preset')
      .insert({
        name: name.trim(),
        video_url: videoUrl.trim(),
        categories: categories || [],
        status: 'analyzing',
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/style-presets' }, 'Error creating style preset');
      return NextResponse.json({ error: 'Failed to create style preset' }, { status: 500 });
    }

    // Enqueue analysis job
    await getPipelineQueue().add('analyze_style_preset', {
      step: 'analyze_style_preset',
      presetId: preset.id,
    });

    logger.info({ presetId: preset.id, route: '/api/style-presets' }, 'Style preset created and analysis enqueued');

    return NextResponse.json(
      { preset: { id: preset.id, name: preset.name, status: preset.status } },
      { status: 201 }
    );
  } catch (err) {
    logger.error({ err, route: '/api/style-presets' }, 'Error creating style preset');
    return NextResponse.json({ error: 'Failed to create style preset' }, { status: 500 });
  }
}
