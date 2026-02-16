import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { TONE_IDS } from '@/lib/constants';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createProjectSchema = z.object({
  productId: z.string().uuid().optional(),
  productUrl: z.string().url('Must be a valid URL').optional(),
  videoUrl: z.string().url().optional(),
  influencerId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  videoModelId: z.string().uuid().optional(),
  name: z.string().optional(),
  tone: z.enum(TONE_IDS as [string, ...string[]]).optional().default('reluctant-insider'),
}).refine(
  (data) => data.productId || data.productUrl,
  { message: 'Either productId or productUrl is required' }
);

export async function GET() {
  const { data: projects, error } = await supabase
    .from('project')
    .select('*, character:ai_character(*), video_model:video_model(*)')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ err: error, route: '/api/projects' }, 'Error listing projects');
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, productUrl, videoUrl, influencerId, characterId, videoModelId, name, tone } = parsed.data;

    // Resolve video model: use provided ID, or fall back to the default model
    let resolvedVideoModelId = videoModelId || null;
    if (!resolvedVideoModelId) {
      const { data: defaultModel } = await supabase
        .from('video_model')
        .select('id')
        .eq('is_default', true)
        .eq('status', 'active')
        .limit(1)
        .single();
      resolvedVideoModelId = defaultModel?.id || null;
    }

    // Path A: existing product by ID
    if (productId) {
      const { data: prod, error: prodError } = await supabase
        .from('product')
        .select('*')
        .eq('id', productId)
        .single();

      if (prodError || !prod) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const { data: newProject, error } = await supabase
        .from('project')
        .insert({
          product_id: productId,
          product_url: prod.url,
          product_name: prod.name || null,
          product_category: prod.category || null,
          product_image_url: prod.image_url || null,
          product_data: prod.analysis_data || null,
          video_url: videoUrl || null,
          influencer_id: influencerId || null,
          character_id: characterId || null,
          video_model_id: resolvedVideoModelId,
          name: name || null,
          tone,
          input_mode: videoUrl ? 'video_analysis' : 'product_only',
          status: prod.status === 'analyzed' ? 'analysis_review' : 'created',
        })
        .select()
        .single();

      if (error) {
        logger.error({ err: error, route: '/api/projects' }, 'Error creating project');
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
      }

      // If product is not yet analyzed, enqueue analysis
      if (prod.status !== 'analyzed') {
        await getPipelineQueue().add('product_analysis', {
          projectId: newProject.id,
          productId: productId,
          step: 'product_analysis',
        });
      }

      return NextResponse.json(newProject, { status: 201 });
    }

    // Path B: new product URL
    // Check if product with this URL already exists
    let linkedProductId: string | null = null;
    let skipAnalysis = false;
    let productData: Record<string, unknown> | null = null;

    const { data: existingProduct } = await supabase
      .from('product')
      .select('*')
      .eq('url', productUrl!)
      .single();

    if (existingProduct) {
      linkedProductId = existingProduct.id;
      if (existingProduct.status === 'analyzed') {
        skipAnalysis = true;
        productData = existingProduct;
      }
    } else {
      // Create new product record
      const { data: newProduct, error: prodCreateError } = await supabase
        .from('product')
        .insert({ url: productUrl!, status: 'created' })
        .select()
        .single();

      if (prodCreateError || !newProduct) {
        logger.error({ err: prodCreateError, route: '/api/projects' }, 'Error creating product');
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
      }

      linkedProductId = newProduct.id;
    }

    const { data: newProject, error } = await supabase
      .from('project')
      .insert({
        product_id: linkedProductId,
        product_url: productUrl!,
        product_name: productData?.name as string || null,
        product_category: productData?.category as string || null,
        product_image_url: productData?.image_url as string || null,
        product_data: productData?.analysis_data || null,
        video_url: videoUrl || null,
        influencer_id: influencerId || null,
        character_id: characterId || null,
        video_model_id: resolvedVideoModelId,
        name: name || null,
        tone,
        input_mode: videoUrl ? 'video_analysis' : 'product_only',
        status: skipAnalysis ? 'analysis_review' : 'created',
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/projects' }, 'Error creating project');
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Enqueue analysis if needed
    if (!skipAnalysis) {
      await getPipelineQueue().add('product_analysis', {
        projectId: newProject.id,
        productId: linkedProductId!,
        step: 'product_analysis',
      });

      // Update product status
      await supabase
        .from('product')
        .update({ status: 'analyzing' })
        .eq('id', linkedProductId!);
    }

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects' }, 'Error creating project');
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
