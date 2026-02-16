import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getPublicUrl } from '@/lib/storage';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';

const wavespeed = new WaveSpeedClient();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  let query = supabase
    .from('influencer')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (searchParams.get('hasImage') === 'true') {
    query = query.not('image_url', 'is', null);
  }

  if (searchParams.get('hasVoice') === 'true') {
    query = query.not('voice_id', 'is', null);
  }

  const { data: influencers, error } = await query;

  if (error) {
    logger.error({ err: error, route: '/api/influencers' }, 'Error listing influencers');
    return NextResponse.json({ error: 'Failed to list influencers' }, { status: 500 });
  }

  return NextResponse.json(influencers);
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name: string | null = null;
    let persona: string | null = null;
    let image: File | null = null;
    let storagePath: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = body.name || null;
      persona = body.persona || null;
      storagePath = body.storagePath || null;
    } else {
      const formData = await request.formData();
      name = formData.get('name') as string | null;
      persona = formData.get('persona') as string | null;
      const imageField = formData.get('image');
      if (imageField && imageField instanceof File && imageField.size > 0) {
        image = imageField;
      }
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Validation failed', details: 'name is required' },
        { status: 400 }
      );
    }

    // Insert the influencer row
    const { data: influencer, error: insertError } = await supabase
      .from('influencer')
      .insert({
        name,
        persona: typeof persona === 'string' ? persona : null,
      })
      .select()
      .single();

    if (insertError) {
      logger.error({ err: insertError, route: '/api/influencers' }, 'Error creating influencer');
      return NextResponse.json({ error: 'Failed to create influencer' }, { status: 500 });
    }

    // Resolve image URL from either path
    let imageUrl: string | null = null;

    if (storagePath) {
      imageUrl = getPublicUrl(storagePath);
    } else if (image) {
      const ext = image.name.split('.').pop() || 'png';
      const legacyPath = `influencers/${influencer.id}/reference.${ext}`;
      const buffer = Buffer.from(await image.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(legacyPath, buffer, { contentType: image.type, upsert: true });

      if (uploadError) {
        logger.error({ err: uploadError, route: '/api/influencers' }, 'Error uploading influencer image');
        return NextResponse.json(influencer, { status: 201 });
      }

      const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(legacyPath);
      imageUrl = publicUrlData.publicUrl;
    }

    if (!imageUrl) {
      return NextResponse.json(influencer, { status: 201 });
    }

    // Upscale to 4K via WaveSpeed (non-fatal)
    let finalUrl = imageUrl;
    let upscaleCost = 0;
    try {
      logger.info({ influencerId: influencer.id, route: '/api/influencers' }, 'Upscaling influencer image to 4K');
      const { taskId } = await wavespeed.upscaleImage(imageUrl, {
        targetResolution: '4k',
        outputFormat: 'png',
      });
      const result = await wavespeed.pollResult(taskId, {
        maxWait: 60000,
        initialInterval: 3000,
      });
      if (result.url) {
        finalUrl = result.url;
        upscaleCost = API_COSTS.imageUpscaler;
        logger.info({ influencerId: influencer.id, taskId }, 'Influencer image upscaled to 4K');
      }
    } catch (upscaleErr) {
      logger.error({ err: upscaleErr, influencerId: influencer.id, route: '/api/influencers' }, 'Influencer image upscale failed, using original');
    }

    // Update influencer with (upscaled) image URL
    const { data: updated, error: updateError } = await supabase
      .from('influencer')
      .update({
        image_url: finalUrl,
        ...(upscaleCost > 0 ? { cost_usd: upscaleCost.toFixed(4) } : {}),
      })
      .eq('id', influencer.id)
      .select()
      .single();

    if (updateError) {
      logger.error({ err: updateError, route: '/api/influencers' }, 'Error updating influencer image_url');
      return NextResponse.json(influencer, { status: 201 });
    }

    return NextResponse.json({ ...updated, upscaled: finalUrl !== imageUrl }, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/influencers' }, 'Error creating influencer');
    return NextResponse.json(
      { error: 'Failed to create influencer' },
      { status: 500 }
    );
  }
}
