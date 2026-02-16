import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';

const elevenlabs = new ElevenLabsClient();

const linkVoiceSchema = z.object({
  voiceId: z.string().min(1, 'voiceId is required').trim(),
});

/**
 * POST /api/influencers/[id]/voice/link
 *
 * Link an existing ElevenLabs voice to an influencer by Voice ID.
 * Validates the voice ID against ElevenLabs, fetches metadata, and saves to the influencer record.
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
      .select('id, name')
      .eq('id', id)
      .single();

    if (infError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = linkVoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { voiceId } = parsed.data;

    // Validate voice ID against ElevenLabs and fetch metadata
    let voiceData: {
      voice_id: string;
      name: string;
      description: string;
      preview_url: string;
      labels: Record<string, string>;
    };

    try {
      voiceData = await elevenlabs.getVoice(voiceId);
    } catch (err) {
      logger.warn(
        { err, influencerId: id, voiceId, route: '/api/influencers/[id]/voice/link' },
        'ElevenLabs voice ID validation failed'
      );
      return NextResponse.json(
        { error: 'Voice ID not found on ElevenLabs. Check the ID and try again.' },
        { status: 404 }
      );
    }

    // Build description from voice name + description
    const voiceDescription = [voiceData.name, voiceData.description]
      .filter(Boolean)
      .join(' — ');

    // Update influencer record
    const { data: updated, error: updateError } = await supabase
      .from('influencer')
      .update({
        voice_id: voiceData.voice_id,
        voice_description: voiceDescription,
        voice_preview_url: voiceData.preview_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(
        { err: updateError, influencerId: id, route: '/api/influencers/[id]/voice/link' },
        'Failed to update influencer with linked voice'
      );
      return NextResponse.json({ error: 'Failed to update influencer' }, { status: 500 });
    }

    logger.info(
      { influencerId: id, voiceId: voiceData.voice_id, voiceName: voiceData.name, route: '/api/influencers/[id]/voice/link' },
      'Voice linked to influencer successfully'
    );

    return NextResponse.json({
      voiceId: voiceData.voice_id,
      voiceName: voiceData.name,
      voiceDescription,
      previewUrl: voiceData.preview_url || null,
      influencer: updated,
    });
  } catch (err) {
    logger.error(
      { err, influencerId: id, route: '/api/influencers/[id]/voice/link' },
      'Error linking voice'
    );
    return NextResponse.json({ error: 'Failed to link voice' }, { status: 500 });
  }
}
