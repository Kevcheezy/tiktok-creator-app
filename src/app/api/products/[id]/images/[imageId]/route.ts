import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { PRODUCT_IMAGE_ANGLES } from '@/lib/constants';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  try {
    const body = await request.json();
    const { angle, isPrimary, sortOrder } = body;

    // Validate angle if provided
    if (angle !== undefined && !PRODUCT_IMAGE_ANGLES.includes(angle as any)) {
      return NextResponse.json(
        { error: `Invalid angle. Must be one of: ${PRODUCT_IMAGE_ANGLES.join(', ')}` },
        { status: 400 }
      );
    }

    // If isPrimary=true, unset all others for this product first
    if (isPrimary === true) {
      await supabase
        .from('product_image')
        .update({ is_primary: false })
        .eq('product_id', id);
    }

    // Build update payload
    const update: Record<string, unknown> = {};
    if (angle !== undefined) update.angle = angle;
    if (isPrimary !== undefined) update.is_primary = isPrimary;
    if (sortOrder !== undefined) update.sort_order = sortOrder;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('product_image')
      .update(update)
      .eq('id', imageId)
      .eq('product_id', id)
      .select()
      .single();

    if (error) {
      logger.error({ err: error, imageId, productId: id, route: '/api/products/[id]/images/[imageId]' }, 'Error updating product image');
      return NextResponse.json({ error: 'Failed to update product image' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Product image not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, imageId, productId: id, route: '/api/products/[id]/images/[imageId]' }, 'Error updating product image');
    return NextResponse.json({ error: 'Failed to update product image' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  const { error } = await supabase
    .from('product_image')
    .delete()
    .eq('id', imageId)
    .eq('product_id', id);

  if (error) {
    logger.error({ err: error, imageId, productId: id, route: '/api/products/[id]/images/[imageId]' }, 'Error deleting product image');
    return NextResponse.json({ error: 'Failed to delete product image' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
