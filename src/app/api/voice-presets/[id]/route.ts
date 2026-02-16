import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/voice-presets/[id]
 *
 * Deletes a custom voice preset. Returns 409 for system presets.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if it exists and whether it's a system preset
    const { data: preset, error: fetchError } = await supabase
      .from('voice_preset')
      .select('id, is_system, name')
      .eq('id', id)
      .single();

    if (fetchError || !preset) {
      return NextResponse.json({ error: 'Voice preset not found' }, { status: 404 });
    }

    if (preset.is_system) {
      return NextResponse.json(
        { error: `Cannot delete system preset "${preset.name}". Only custom presets can be deleted.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('voice_preset')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/voice-presets/[id]' }, 'Error deleting voice preset');
      return NextResponse.json({ error: 'Failed to delete voice preset' }, { status: 500 });
    }

    return NextResponse.json({ message: `Deleted voice preset "${preset.name}"` });
  } catch (err) {
    logger.error({ err, route: '/api/voice-presets/[id]' }, 'Error deleting voice preset');
    return NextResponse.json({ error: 'Failed to delete voice preset' }, { status: 500 });
  }
}
