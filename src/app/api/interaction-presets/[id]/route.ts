import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const patchInteractionPresetSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'At least one field (title or description) is required',
  });

/**
 * PATCH /api/interaction-presets/[id]
 *
 * Updates title and/or description on any interaction preset (system or custom).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = patchInteractionPresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'At least one field (title or description) is required' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from('interaction_preset')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Interaction preset not found' }, { status: 404 });
    }

    const updates: Record<string, string> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.description !== undefined) updates.description = parsed.data.description.trim();

    const { data: updated, error: updateError } = await supabase
      .from('interaction_preset')
      .update(updates)
      .eq('id', id)
      .select('id, title, description, category_affinity, is_custom, is_default, sort_order')
      .single();

    if (updateError) {
      logger.error({ err: updateError, route: '/api/interaction-presets/[id]' }, 'Error updating interaction preset');
      return NextResponse.json({ error: 'Failed to update interaction preset' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err, route: '/api/interaction-presets/[id]' }, 'Error updating interaction preset');
    return NextResponse.json({ error: 'Failed to update interaction preset' }, { status: 500 });
  }
}

/**
 * DELETE /api/interaction-presets/[id]
 *
 * Deletes a custom interaction preset. Returns 409 for system presets.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if it's a system preset
    const { data: preset, error: fetchError } = await supabase
      .from('interaction_preset')
      .select('id, is_custom, title')
      .eq('id', id)
      .single();

    if (fetchError || !preset) {
      return NextResponse.json({ error: 'Interaction preset not found' }, { status: 404 });
    }

    if (!preset.is_custom) {
      return NextResponse.json(
        { error: `Cannot delete system preset "${preset.title}". Only custom presets can be deleted.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('interaction_preset')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/interaction-presets/[id]' }, 'Error deleting interaction preset');
      return NextResponse.json({ error: 'Failed to delete interaction preset' }, { status: 500 });
    }

    return NextResponse.json({ message: `Deleted interaction preset "${preset.title}"` });
  } catch (err) {
    logger.error({ err, route: '/api/interaction-presets/[id]' }, 'Error deleting interaction preset');
    return NextResponse.json({ error: 'Failed to delete interaction preset' }, { status: 500 });
  }
}
