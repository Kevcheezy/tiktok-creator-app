import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { ElevenLabsClient } from '@/lib/api-clients/elevenlabs';

const elevenlabs = new ElevenLabsClient();

const DEFAULT_SAMPLE_TEXT =
  'Hey, I just tried this product and I have to tell you about it. The results were honestly incredible and I think everyone needs to know.';

const designVoiceSchema = z
  .object({
    presetId: z.string().uuid().optional(),
    customDescription: z.string().min(1).optional(),
    gender: z.enum(['male', 'female']).optional(),
  })
  .refine((data) => data.presetId || data.customDescription, {
    message: 'Either presetId or customDescription is required',
  });

/**
 * POST /api/influencers/[id]/voice/design
 *
 * Generate a voice preview for the influencer via ElevenLabs Voice Design API.
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
    const parsed = designVoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { presetId, customDescription } = parsed.data;

    // Resolve description, gender, and sample_text from preset or custom input
    let description: string;
    let gender: string = 'female';
    let sampleText: string = DEFAULT_SAMPLE_TEXT;

    if (presetId) {
      const { data: preset, error: presetError } = await supabase
        .from('voice_preset')
        .select('*')
        .eq('id', presetId)
        .single();

      if (presetError || !preset) {
        return NextResponse.json({ error: 'Voice preset not found' }, { status: 404 });
      }

      description = preset.description;
      gender = preset.gender;
      if (preset.sample_text) {
        sampleText = preset.sample_text;
      }
    } else {
      description = customDescription!;
      gender = parsed.data.gender || 'female';
    }

    // Call ElevenLabs Voice Design API
    logger.info(
      { influencerId: id, presetId, gender, route: '/api/influencers/[id]/voice/design' },
      'Designing voice via ElevenLabs'
    );

    let designResult: { generatedVoiceId: string; audioBase64: string };
    try {
      designResult = await elevenlabs.designVoice(description, sampleText, gender);
    } catch (err) {
      logger.error(
        { err, influencerId: id, route: '/api/influencers/[id]/voice/design' },
        'ElevenLabs Voice Design API call failed'
      );
      return NextResponse.json(
        { error: 'Voice design failed. Please try again.' },
        { status: 500 }
      );
    }

    // Upload preview audio to Supabase Storage
    const storagePath = `influencers/${id}/voice-preview.mp3`;
    const audioBuffer = Buffer.from(designResult.audioBase64, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      logger.error(
        { err: uploadError, influencerId: id, route: '/api/influencers/[id]/voice/design' },
        'Failed to upload voice preview audio'
      );
      return NextResponse.json(
        { error: 'Failed to upload voice preview' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('assets')
      .getPublicUrl(storagePath);

    // Append cache-buster so the browser re-fetches after re-design
    const previewUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    logger.info(
      { influencerId: id, temporaryVoiceId: designResult.generatedVoiceId, route: '/api/influencers/[id]/voice/design' },
      'Voice preview generated successfully'
    );

    return NextResponse.json({
      previewUrl,
      temporaryVoiceId: designResult.generatedVoiceId,
      description,
    });
  } catch (err) {
    logger.error(
      { err, influencerId: id, route: '/api/influencers/[id]/voice/design' },
      'Error designing voice'
    );
    return NextResponse.json({ error: 'Failed to design voice' }, { status: 500 });
  }
}
