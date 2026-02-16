import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { logger } from '@/lib/logger';

// Fields that can be user-overridden via PATCH
const EDITABLE_FIELDS = [
  'name', 'brand', 'category', 'product_type', 'product_size', 'product_price',
  'selling_points', 'key_claims', 'benefits', 'usage', 'hook_angle',
  'avatar_description', 'image_description',
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: prod, error } = await supabase
    .from('product')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !prod) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get projects using this product
  const { data: projects, count } = await supabase
    .from('project')
    .select('id, name, product_name, status, created_at', { count: 'exact' })
    .eq('product_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ ...prod, project_count: count || 0, projects: projects || [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Handle field resets
    if (body.reset && Array.isArray(body.reset)) {
      const { data: existing } = await supabase
        .from('product')
        .select('analysis_data, overrides')
        .eq('id', id)
        .single();

      if (!existing) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const analysisData = (existing.analysis_data || {}) as Record<string, unknown>;
      const overrides = (existing.overrides || {}) as Record<string, boolean>;
      const resetUpdates: Record<string, unknown> = {};

      // Map analysis_data field names to DB column names
      const fieldMapping: Record<string, string> = {
        name: 'product_name',
        image_description: 'image_description_for_nano_banana_pro',
      };

      for (const field of body.reset) {
        if (!EDITABLE_FIELDS.includes(field)) continue;

        // Look up original value from analysis_data
        const analysisKey = fieldMapping[field] || field;
        if (analysisKey in analysisData) {
          resetUpdates[field] = analysisData[analysisKey];
        }
        delete overrides[field];
      }

      const { data: updated, error } = await supabase
        .from('product')
        .update({
          ...resetUpdates,
          overrides,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !updated) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json(updated);
    }

    // Handle regular field updates
    const updates: Record<string, unknown> = {};
    const overrideKeys: string[] = [];

    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        // Validate category
        if (field === 'category') {
          const validCategories: readonly string[] = PRODUCT_CATEGORIES;
          if (!validCategories.includes(body.category)) {
            return NextResponse.json(
              { error: `Invalid category. Must be one of: ${PRODUCT_CATEGORIES.join(', ')}` },
              { status: 400 }
            );
          }
        }
        updates[field] = body[field];
        overrideKeys.push(field);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Merge override tracking
    const { data: existing } = await supabase
      .from('product')
      .select('overrides')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const overrides = (existing.overrides || {}) as Record<string, boolean>;
    for (const key of overrideKeys) {
      overrides[key] = true;
    }

    updates.overrides = overrides;
    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('product')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, route: '/api/products/[id]' }, 'Error updating product');
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Guard: check if any projects reference this product
    const { count } = await supabase
      .from('project')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete product: ${count} project(s) still reference this product` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('product')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: '/api/products/[id]' }, 'Error deleting product');
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, route: '/api/products/[id]' }, 'Error deleting product');
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
