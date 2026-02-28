import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/style-presets/[id]
 *
 * Returns the full style preset record by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: preset, error } = await supabase
    .from('style_preset')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !preset) {
    return NextResponse.json({ error: 'Style preset not found' }, { status: 404 });
  }

  return NextResponse.json({ preset });
}

/**
 * PATCH /api/style-presets/[id]
 *
 * Updates name and/or categories for a style preset.
 * Body: { name?: string, categories?: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if ('categories' in body) {
      if (!Array.isArray(body.categories)) {
        return NextResponse.json({ error: 'categories must be an array' }, { status: 400 });
      }
      updates.categories = body.categories;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update (name, categories)' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: preset, error } = await supabase
      .from('style_preset')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !preset) {
      return NextResponse.json({ error: 'Style preset not found' }, { status: 404 });
    }

    return NextResponse.json({ preset });
  } catch (err) {
    logger.error({ err, route: '/api/style-presets/[id]' }, 'Error updating style preset');
    return NextResponse.json({ error: 'Failed to update style preset' }, { status: 500 });
  }
}

/**
 * DELETE /api/style-presets/[id]
 *
 * Deletes a style preset record.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { error } = await supabase
      .from('style_preset')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/style-presets/[id]' }, 'Error deleting style preset');
      return NextResponse.json({ error: 'Failed to delete style preset' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: '/api/style-presets/[id]' }, 'Error deleting style preset');
    return NextResponse.json({ error: 'Failed to delete style preset' }, { status: 500 });
  }
}
