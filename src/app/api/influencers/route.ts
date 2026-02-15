import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const { data: influencers, error } = await supabase
    .from('influencer')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ err: error, route: '/api/influencers' }, 'Error listing influencers');
    return NextResponse.json({ error: 'Failed to list influencers' }, { status: 500 });
  }

  return NextResponse.json(influencers);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get('name');
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Validation failed', details: 'name is required' },
        { status: 400 }
      );
    }

    const persona = formData.get('persona');
    const image = formData.get('image');

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

    // If an image file was provided, upload to Supabase Storage
    if (image && image instanceof File) {
      const ext = image.name.split('.').pop() || 'png';
      const storagePath = `influencers/${influencer.id}/reference.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(storagePath, image, { upsert: true });

      if (uploadError) {
        logger.error({ err: uploadError, route: '/api/influencers' }, 'Error uploading influencer image');
        // Still return the influencer, but without the image
        return NextResponse.json(influencer, { status: 201 });
      }

      const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(storagePath);

      const { data: updated, error: updateError } = await supabase
        .from('influencer')
        .update({ image_url: publicUrlData.publicUrl })
        .eq('id', influencer.id)
        .select()
        .single();

      if (updateError) {
        logger.error({ err: updateError, route: '/api/influencers' }, 'Error updating influencer image_url');
        return NextResponse.json(influencer, { status: 201 });
      }

      return NextResponse.json(updated, { status: 201 });
    }

    return NextResponse.json(influencer, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/influencers' }, 'Error creating influencer');
    return NextResponse.json(
      { error: 'Failed to create influencer' },
      { status: 500 }
    );
  }
}
