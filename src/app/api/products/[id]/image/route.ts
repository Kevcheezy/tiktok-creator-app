import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getPublicUrl } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify product exists
    const { data: prod, error: prodError } = await supabase
      .from('product')
      .select('id')
      .eq('id', id)
      .single();

    if (prodError || !prod) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let publicUrl: string;

    if (contentType.includes('application/json')) {
      // Direct-to-storage: file already uploaded via signed URL
      const body = await request.json();
      const { storagePath } = body;
      if (!storagePath || typeof storagePath !== 'string') {
        return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
      }
      publicUrl = getPublicUrl(storagePath);
    } else {
      // Legacy: server-side upload via FormData
      const formData = await request.formData();
      const file = formData.get('image') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

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
        logger.error({ err: uploadError, route: '/api/products/[id]/image' }, 'Upload error');
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
      publicUrl = urlData.publicUrl;
    }

    // Update product with image URL
    await supabase
      .from('product')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error({ err: error, route: '/api/products/[id]/image' }, 'Error uploading product image');
    return NextResponse.json({ error: 'Failed to upload product image' }, { status: 500 });
  }
}
