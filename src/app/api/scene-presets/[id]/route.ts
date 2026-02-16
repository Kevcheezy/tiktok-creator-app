import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const patchScenePresetSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'At least one field (title or description) is required',
  });

/**
 * PATCH /api/scene-presets/[id]
 *
 * Updates title and/or description on any scene preset (system or custom).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = patchScenePresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'At least one field (title or description) is required' },
        { status: 400 }
      );
    }

    // Verify preset exists
    const { data: existing, error: fetchError } = await supabase
      .from('scene_preset')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Scene preset not found' }, { status: 404 });
    }

    // Build update payload with only provided fields
    const updates: Record<string, string> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.description !== undefined) updates.description = parsed.data.description.trim();

    const { data: updated, error: updateError } = await supabase
      .from('scene_preset')
      .update(updates)
      .eq('id', id)
      .select('id, title, description, category_affinity, is_custom, is_default, sort_order')
      .single();

    if (updateError) {
      logger.error({ err: updateError, route: '/api/scene-presets/[id]' }, 'Error updating scene preset');
      return NextResponse.json({ error: 'Failed to update scene preset' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err, route: '/api/scene-presets/[id]' }, 'Error updating scene preset');
    return NextResponse.json({ error: 'Failed to update scene preset' }, { status: 500 });
  }
}

/**
 * DELETE /api/scene-presets/[id]
 *
 * Deletes a custom scene preset. Returns 409 for system presets.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if it's a system preset
    const { data: preset, error: fetchError } = await supabase
      .from('scene_preset')
      .select('id, is_custom, title')
      .eq('id', id)
      .single();

    if (fetchError || !preset) {
      return NextResponse.json({ error: 'Scene preset not found' }, { status: 404 });
    }

    if (!preset.is_custom) {
      return NextResponse.json(
        { error: `Cannot delete system preset "${preset.title}". Only custom presets can be deleted.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('scene_preset')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/scene-presets/[id]' }, 'Error deleting scene preset');
      return NextResponse.json({ error: 'Failed to delete scene preset' }, { status: 500 });
    }

    return NextResponse.json({ message: `Deleted scene preset "${preset.title}"` });
  } catch (err) {
    logger.error({ err, route: '/api/scene-presets/[id]' }, 'Error deleting scene preset');
    return NextResponse.json({ error: 'Failed to delete scene preset' }, { status: 500 });
  }
}
