import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Verify product exists
    const { data: prod, error: prodError } = await supabase
      .from('product')
      .select('id, status')
      .eq('id', id)
      .single();

    if (prodError || !prod) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (prod.status === 'analyzing') {
      return NextResponse.json({ error: 'Analysis already in progress' }, { status: 409 });
    }

    // Set status to analyzing
    await supabase
      .from('product')
      .update({
        status: 'analyzing',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Enqueue analysis job
    await getPipelineQueue().add('product_analysis', {
      productId: id,
      step: 'product_analysis',
    });

    return NextResponse.json({ message: 'Reanalysis enqueued', productId: id });
  } catch (error) {
    logger.error({ err: error, route: '/api/products/[id]/reanalyze' }, 'Error enqueuing reanalysis');
    return NextResponse.json({ error: 'Failed to enqueue reanalysis' }, { status: 500 });
  }
}
