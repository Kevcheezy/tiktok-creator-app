import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/voice-presets
 *
 * Returns all voice presets ordered by name.
 * Optional ?category=X sorts matching category affinity first.
 */
export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');

    const { data, error } = await supabase
      .from('voice_preset')
      .select('*')
      .order('name');

    if (error) {
      logger.error({ err: error, route: '/api/voice-presets' }, 'Error fetching voice presets');
      return NextResponse.json({ error: 'Failed to fetch voice presets' }, { status: 500 });
    }

    let presets = data || [];

    // Sort by category affinity if category param provided
    if (category) {
      const cat = category.toLowerCase();
      presets = [
        ...presets.filter((p: Record<string, unknown>) => {
          const affinity = p.category_affinity as string[];
          return affinity?.some((a: string) => a.toLowerCase() === cat);
        }),
        ...presets.filter((p: Record<string, unknown>) => {
          const affinity = p.category_affinity as string[];
          return !affinity?.some((a: string) => a.toLowerCase() === cat);
        }),
      ];
    }

    return NextResponse.json({ presets });
  } catch (err) {
    logger.error({ err, route: '/api/voice-presets' }, 'Error fetching voice presets');
    return NextResponse.json({ error: 'Failed to fetch voice presets' }, { status: 500 });
  }
}

const createPresetSchema = z.object({
  name: z.string().min(1, 'name is required').trim(),
  description: z.string().min(1, 'description is required').trim(),
  gender: z.enum(['male', 'female']),
  sampleText: z.string().trim().optional(),
  categoryAffinity: z.array(z.string()).optional(),
});

/**
 * POST /api/voice-presets
 *
 * Creates a custom voice preset (is_system = false).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createPresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, description, gender, sampleText, categoryAffinity } = parsed.data;

    const { data, error } = await supabase
      .from('voice_preset')
      .insert({
        name,
        description,
        gender,
        sample_text: sampleText || null,
        category_affinity: categoryAffinity || [],
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/voice-presets' }, 'Error creating voice preset');
      return NextResponse.json({ error: 'Failed to create voice preset' }, { status: 500 });
    }

    return NextResponse.json({ preset: data }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: '/api/voice-presets' }, 'Error creating voice preset');
    return NextResponse.json({ error: 'Failed to create voice preset' }, { status: 500 });
  }
}
