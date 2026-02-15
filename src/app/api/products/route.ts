import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createProductSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export async function GET() {
  // List all products with project count
  const { data: products, error } = await supabase
    .from('product')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ err: error, route: '/api/products' }, 'Error listing products');
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }

  // Get project counts per product
  const productIds = products.map((p: { id: string }) => p.id);
  let projectCounts: Record<string, number> = {};

  if (productIds.length > 0) {
    const { data: counts } = await supabase
      .from('project')
      .select('product_id')
      .in('product_id', productIds);

    if (counts) {
      projectCounts = counts.reduce((acc: Record<string, number>, row: { product_id: string }) => {
        acc[row.product_id] = (acc[row.product_id] || 0) + 1;
        return acc;
      }, {});
    }
  }

  const result = products.map((p: { id: string }) => ({
    ...p,
    project_count: projectCounts[p.id] || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from('product')
      .select('*')
      .eq('url', url)
      .single();

    if (existing) {
      // If failed, re-enqueue analysis
      if (existing.status === 'failed') {
        await supabase
          .from('product')
          .update({ status: 'analyzing', error_message: null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        await getPipelineQueue().add('product_analysis', {
          productId: existing.id,
          step: 'product_analysis',
        });

        return NextResponse.json({ ...existing, status: 'analyzing' });
      }

      // Already exists (analyzing or analyzed) — return as-is
      return NextResponse.json(existing);
    }

    // Create new product
    const { data: newProduct, error } = await supabase
      .from('product')
      .insert({ url, status: 'created' })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/products' }, 'Error creating product');
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    // Enqueue analysis
    await getPipelineQueue().add('product_analysis', {
      productId: newProduct.id,
      step: 'product_analysis',
    });

    await supabase
      .from('product')
      .update({ status: 'analyzing' })
      .eq('id', newProduct.id);

    return NextResponse.json({ ...newProduct, status: 'analyzing' }, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/products' }, 'Error creating product');
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
