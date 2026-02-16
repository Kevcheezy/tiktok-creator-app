import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/interaction-presets
 *
 * Returns all interaction presets ordered by sort_order.
 * Optional ?category=X sorts matching categories first.
 */
export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');

    const { data, error } = await supabase
      .from('interaction_preset')
      .select('*')
      .order('sort_order');

    if (error) {
      logger.error({ err: error, route: '/api/interaction-presets' }, 'Error fetching interaction presets');
      return NextResponse.json({ error: 'Failed to fetch interaction presets' }, { status: 500 });
    }

    let presets = data || [];

    // Sort by category affinity if category param provided
    if (category) {
      const cat = category.toLowerCase();
      presets = [
        ...presets.filter((p: any) => {
          const affinity = p.category_affinity as string[];
          return affinity?.some((a: string) => a.toLowerCase() === cat || a === 'any');
        }),
        ...presets.filter((p: any) => {
          const affinity = p.category_affinity as string[];
          return !affinity?.some((a: string) => a.toLowerCase() === cat || a === 'any');
        }),
      ];
    }

    return NextResponse.json({ presets });
  } catch (err) {
    logger.error({ err, route: '/api/interaction-presets' }, 'Error fetching interaction presets');
    return NextResponse.json({ error: 'Failed to fetch interaction presets' }, { status: 500 });
  }
}

/**
 * POST /api/interaction-presets
 *
 * Creates a custom interaction preset.
 * Body: { title: string, description: string, categoryAffinity?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, categoryAffinity } = body as {
      title?: string;
      description?: string;
      categoryAffinity?: string[];
    };

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    // Get next sort_order
    const { data: maxRow } = await supabase
      .from('interaction_preset')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxRow?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from('interaction_preset')
      .insert({
        title: title.trim(),
        description: description.trim(),
        category_affinity: categoryAffinity || [],
        is_custom: true,
        is_default: false,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/interaction-presets' }, 'Error creating interaction preset');
      return NextResponse.json({ error: 'Failed to create interaction preset' }, { status: 500 });
    }

    return NextResponse.json({ preset: data }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: '/api/interaction-presets' }, 'Error creating interaction preset');
    return NextResponse.json({ error: 'Failed to create interaction preset' }, { status: 500 });
  }
}
