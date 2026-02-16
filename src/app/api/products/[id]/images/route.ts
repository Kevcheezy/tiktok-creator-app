import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getPublicUrl } from '@/lib/storage';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS, PRODUCT_IMAGE_ANGLES } from '@/lib/constants';

const wavespeed = new WaveSpeedClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: images, error } = await supabase
    .from('product_image')
    .select('*')
    .eq('product_id', id)
    .order('sort_order');

  if (error) {
    logger.error({ err: error, route: '/api/products/[id]/images' }, 'Error listing product images');
    return NextResponse.json({ error: 'Failed to list product images' }, { status: 500 });
  }

  return NextResponse.json(images || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify product exists
    const { data: prod, error: prodError } = await supabase
      .from('product')
      .select('id, cost_usd')
      .eq('id', id)
      .single();

    if (prodError || !prod) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let publicUrl: string;
    let angle: string = 'front';
    let isPrimary = false;

    if (contentType.includes('application/json')) {
      // Direct-to-storage: file already uploaded via signed URL
      const body = await request.json();
      const { storagePath, angle: bodyAngle, isPrimary: bodyIsPrimary } = body;

      if (!storagePath || typeof storagePath !== 'string') {
        return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
      }

      publicUrl = getPublicUrl(storagePath);

      if (bodyAngle) angle = bodyAngle;
      if (bodyIsPrimary) isPrimary = true;
    } else {
      // Legacy: server-side upload via FormData
      const formData = await request.formData();
      const file = formData.get('image') as File | null;
      const formAngle = formData.get('angle') as string | null;
      const formIsPrimary = formData.get('isPrimary') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      if (formAngle) angle = formAngle;
      if (formIsPrimary === 'true') isPrimary = true;

      const ext = file.name.split('.').pop() || 'png';
      const uuid = crypto.randomUUID().slice(0, 8);
      const path = `products/${id}/angles/${uuid}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(path, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        logger.error({ err: uploadError, route: '/api/products/[id]/images' }, 'Upload error');
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
      publicUrl = urlData.publicUrl;
    }

    // Validate angle
    if (!PRODUCT_IMAGE_ANGLES.includes(angle as any)) {
      return NextResponse.json(
        { error: `Invalid angle. Must be one of: ${PRODUCT_IMAGE_ANGLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Upscale to 4K via WaveSpeed (non-fatal)
    let finalUrl = publicUrl;
    let upscaleCost = 0;
    try {
      logger.info({ productId: id, route: '/api/products/[id]/images' }, 'Upscaling product image to 4K');
      const { taskId } = await wavespeed.upscaleImage(publicUrl, {
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
        logger.info({ productId: id, taskId }, 'Product image upscaled to 4K');
      }
    } catch (upscaleErr) {
      // Non-fatal: use the original image if upscale fails
      logger.error({ err: upscaleErr, productId: id, route: '/api/products/[id]/images' }, 'Image upscale failed, using original');
    }

    // Track upscale cost on the product
    if (upscaleCost > 0) {
      const currentCost = parseFloat(prod.cost_usd || '0');
      await supabase
        .from('product')
        .update({ cost_usd: (currentCost + upscaleCost).toFixed(4) })
        .eq('id', id);
    }

    // Determine sort_order (auto-increment)
    const { data: maxRow } = await supabase
      .from('product_image')
      .select('sort_order')
      .eq('product_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    // If isPrimary, unset all other images' is_primary for this product
    if (isPrimary) {
      await supabase
        .from('product_image')
        .update({ is_primary: false })
        .eq('product_id', id);
    }

    // Insert product_image row
    const { data: newImage, error: insertError } = await supabase
      .from('product_image')
      .insert({
        product_id: id,
        url: finalUrl,
        angle,
        is_primary: isPrimary,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (insertError) {
      logger.error({ err: insertError, route: '/api/products/[id]/images' }, 'Error inserting product image');
      return NextResponse.json({ error: 'Failed to create product image' }, { status: 500 });
    }

    // Fire-and-forget: attempt bg removal via WaveSpeed editImage
    (async () => {
      try {
        logger.info({ productId: id, imageId: newImage.id, route: '/api/products/[id]/images' }, 'Starting background removal');
        const { taskId } = await wavespeed.editImage(
          [finalUrl],
          'Product on pure white background, remove all background elements, clean product cutout, professional product photography on white',
          { resolution: '1k' }
        );

        const result = await wavespeed.pollResult(taskId, {
          maxWait: 120000,
          initialInterval: 5000,
        });

        if (result.url) {
          await supabase
            .from('product_image')
            .update({ url_clean: result.url })
            .eq('id', newImage.id);

          // Track bg removal cost
          const { data: currentProd } = await supabase
            .from('product')
            .select('cost_usd')
            .eq('id', id)
            .single();
          const currentCost = parseFloat(currentProd?.cost_usd || '0');
          await supabase
            .from('product')
            .update({ cost_usd: (currentCost + API_COSTS.productBgRemoval).toFixed(4) })
            .eq('id', id);

          logger.info({ productId: id, imageId: newImage.id, taskId }, 'Background removal completed');
        }
      } catch (bgErr) {
        logger.error({ err: bgErr, productId: id, imageId: newImage.id, route: '/api/products/[id]/images' }, 'Background removal failed (non-fatal)');
      }
    })();

    return NextResponse.json(newImage, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/products/[id]/images' }, 'Error uploading product image');
    return NextResponse.json({ error: 'Failed to upload product image' }, { status: 500 });
  }
}
