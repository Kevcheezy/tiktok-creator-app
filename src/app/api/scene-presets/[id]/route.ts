import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

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
