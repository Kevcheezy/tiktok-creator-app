import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Verify project exists
    const { data: proj, error: projError } = await supabase
      .from('project')
      .select('id')
      .eq('id', id)
      .single();

    if (projError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'png';
    const path = `products/${id}/product.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logger.error({ err: uploadError, route: '/api/projects/[id]/product-image' }, 'Upload error');
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update project with product image URL
    await supabase
      .from('project')
      .update({
        product_image_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/product-image' }, 'Error uploading product image');
    return NextResponse.json({ error: 'Failed to upload product image' }, { status: 500 });
  }
}
