import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/broll/[shotId]/upload
 * Upload a user image to replace a B-roll shot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> }
) {
  const { id, shotId } = await params;

  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Verify shot exists and belongs to project
    const { data: shot, error: shotError } = await supabase
      .from('broll_shot')
      .select('*')
      .eq('id', shotId)
      .eq('project_id', id)
      .single();

    if (shotError || !shot) {
      return NextResponse.json({ error: 'B-roll shot not found' }, { status: 404 });
    }

    // Upload to Supabase Storage
    const ext = image.name.split('.').pop() || 'jpg';
    const fileName = `assets/broll/${id}/${shotId}.${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(fileName, buffer, {
        contentType: image.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(fileName);

    // Update shot record
    await supabase
      .from('broll_shot')
      .update({
        image_url: urlData.publicUrl,
        source: 'user_uploaded',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shotId);

    return NextResponse.json({
      message: 'Image uploaded successfully',
      imageUrl: urlData.publicUrl,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/broll/[shotId]/upload' }, 'Error uploading B-roll image');
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
