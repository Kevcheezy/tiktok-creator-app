import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

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
