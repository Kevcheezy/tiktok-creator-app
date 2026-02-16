import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { deleteStorageFile, extractStoragePath } from '@/lib/storage';

/**
 * DELETE /api/influencers/[id]/voice
 *
 * Remove the linked voice from an influencer.
 * Clears voice_id, voice_description, voice_preview_url.
 * Deletes preview audio from Supabase Storage.
 * Does NOT delete the voice from ElevenLabs (may be in use by active projects).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify influencer exists and get current voice data
    const { data: influencer, error: infError } = await supabase
      .from('influencer')
      .select('id, name, voice_id, voice_preview_url')
      .eq('id', id)
      .single();

    if (infError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Delete preview audio from storage if it exists
    if (influencer.voice_preview_url) {
      const storagePath = extractStoragePath(influencer.voice_preview_url);
      if (storagePath) {
        await deleteStorageFile(storagePath);
      }
    }

    // Clear voice fields on the influencer
    const { error: updateError } = await supabase
      .from('influencer')
      .update({
        voice_id: null,
        voice_description: null,
        voice_preview_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logger.error(
        { err: updateError, influencerId: id, route: '/api/influencers/[id]/voice' },
        'Failed to clear voice from influencer'
      );
      return NextResponse.json({ error: 'Failed to remove voice' }, { status: 500 });
    }

    logger.info(
      { influencerId: id, previousVoiceId: influencer.voice_id, route: '/api/influencers/[id]/voice' },
      'Voice removed from influencer'
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error(
      { err, influencerId: id, route: '/api/influencers/[id]/voice' },
      'Error removing voice'
    );
    return NextResponse.json({ error: 'Failed to remove voice' }, { status: 500 });
  }
}
