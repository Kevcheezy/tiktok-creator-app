import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';

const elevenlabs = new ElevenLabsClient();

const approveVoiceSchema = z.object({
  temporaryVoiceId: z.string().min(1, 'temporaryVoiceId is required'),
  presetId: z.string().uuid().optional(),
  description: z.string().min(1, 'description is required'),
});

/**
 * POST /api/influencers/[id]/voice/approve
 *
 * Save the previewed voice permanently to ElevenLabs and update the influencer record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify influencer exists
    const { data: influencer, error: infError } = await supabase
      .from('influencer')
      .select('id, name, voice_preview_url')
      .eq('id', id)
      .single();

    if (infError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = approveVoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { temporaryVoiceId, presetId, description } = parsed.data;

    // Save voice permanently to ElevenLabs
    logger.info(
      { influencerId: id, temporaryVoiceId, route: '/api/influencers/[id]/voice/approve' },
      'Saving voice permanently to ElevenLabs'
    );

    let permanentVoiceId: string;
    try {
      permanentVoiceId = await elevenlabs.saveVoice(
        temporaryVoiceId,
        `${influencer.name} Voice`,
        description
      );
    } catch (err) {
      logger.error(
        { err, influencerId: id, temporaryVoiceId, route: '/api/influencers/[id]/voice/approve' },
        'ElevenLabs saveVoice API call failed'
      );
      return NextResponse.json(
        { error: 'Failed to save voice. The preview may have expired. Please design a new voice.' },
        { status: 500 }
      );
    }

    // Build the preview URL (it was uploaded during /design)
    const storagePath = `influencers/${id}/voice-preview.mp3`;
    const { data: publicUrlData } = supabase.storage
      .from('assets')
      .getPublicUrl(storagePath);
    const previewUrl = publicUrlData.publicUrl;

    // Update influencer record
    const { data: updated, error: updateError } = await supabase
      .from('influencer')
      .update({
        voice_id: permanentVoiceId,
        voice_preset_id: presetId || null,
        voice_description: description,
        voice_preview_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(
        { err: updateError, influencerId: id, route: '/api/influencers/[id]/voice/approve' },
        'Failed to update influencer with voice data'
      );
      return NextResponse.json({ error: 'Failed to update influencer' }, { status: 500 });
    }

    logger.info(
      { influencerId: id, voiceId: permanentVoiceId, route: '/api/influencers/[id]/voice/approve' },
      'Voice approved and saved permanently'
    );

    return NextResponse.json({
      voiceId: permanentVoiceId,
      previewUrl,
      influencer: updated,
    });
  } catch (err) {
    logger.error(
      { err, influencerId: id, route: '/api/influencers/[id]/voice/approve' },
      'Error approving voice'
    );
    return NextResponse.json({ error: 'Failed to approve voice' }, { status: 500 });
  }
}
