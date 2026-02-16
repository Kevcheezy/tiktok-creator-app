import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';
import { logger } from '@/lib/logger';

const wavespeed = new WaveSpeedClient();

const REGENERABLE_FIELDS = [
  'selling_points',
  'key_claims',
  'benefits',
  'usage',
  'hook_angle',
  'avatar_description',
  'image_description_for_nano_banana_pro',
] as const;

type RegenerableField = typeof REGENERABLE_FIELDS[number];

const FIELD_INSTRUCTIONS: Record<RegenerableField, string> = {
  selling_points: 'Generate 3-5 unique selling points that differentiate this product from competitors. Focus on what makes it special.',
  key_claims: 'Generate 3-5 factual, verifiable claims with specific numbers when possible (e.g., "20g collagen per serving").',
  benefits: 'Generate 3-5 concrete consumer benefits. Focus on outcomes the buyer will experience.',
  usage: 'Write 1-2 concise sentences explaining how to use this product.',
  hook_angle: 'Write a specific emotional or logical hook strategy for a 60-second TikTok UGC video. What will make viewers stop scrolling? Be specific, not generic.',
  avatar_description: 'Describe the ideal authority figure to present this product. Include: profession, appearance, wardrobe, setting. Match the product category.',
  image_description_for_nano_banana_pro: 'Write a detailed visual description of the product packaging for AI image generation. Include: container type, colors, label design, distinguishing features.',
};

const ARRAY_FIELDS: RegenerableField[] = ['selling_points', 'key_claims', 'benefits'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { field, feedback } = body;

    if (!field || !REGENERABLE_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${REGENERABLE_FIELDS.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: project, error: fetchError } = await supabase
      .from('project')
      .select('id, product_url, product_name, product_category, product_data, cost_usd')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.product_data || typeof project.product_data !== 'object') {
      return NextResponse.json(
        { error: 'No product data to regenerate from. Run analysis first.' },
        { status: 400 }
      );
    }

    const productData = project.product_data as Record<string, unknown>;
    const isArray = ARRAY_FIELDS.includes(field);

    const systemPrompt = `You are an expert product analyst for TikTok Shop UGC video production.
You MUST respond with valid JSON only. No markdown, no code fences, no explanation text.
${isArray ? `Return a JSON array of strings: ["item1", "item2", ...]` : `Return a JSON object: {"value": "your text here"}`}`;

    let userPrompt = `Product: ${project.product_name || 'Unknown'} (${project.product_category || 'Unknown category'})
Product URL: ${project.product_url}

Current product data:
${JSON.stringify(productData, null, 2)}

TASK: Regenerate ONLY the "${field}" field.
${FIELD_INSTRUCTIONS[field as RegenerableField]}`;

    if (feedback) {
      userPrompt += `\n\nUser feedback: ${feedback}`;
    }

    const currentValue = productData[field];
    if (currentValue) {
      userPrompt += `\n\nCurrent value being replaced: ${JSON.stringify(currentValue)}`;
    }

    logger.info({ projectId: id, field, route: '/api/projects/[id]/regenerate-field' }, 'Regenerating analysis field');

    const rawResponse = await wavespeed.chatCompletion(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 2048,
    });

    const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let newValue: unknown;

    try {
      const parsed = JSON.parse(cleaned);
      if (isArray) {
        if (!Array.isArray(parsed)) {
          return NextResponse.json({ error: 'LLM returned invalid format for array field' }, { status: 500 });
        }
        newValue = parsed;
      } else {
        newValue = typeof parsed === 'object' && parsed.value ? parsed.value : parsed;
      }
    } catch {
      if (!isArray) {
        newValue = cleaned;
      } else {
        return NextResponse.json({ error: 'Failed to parse LLM response' }, { status: 500 });
      }
    }

    const updatedData = { ...productData, [field]: newValue };

    const { error: updateError } = await supabase
      .from('project')
      .update({
        product_data: updatedData,
        cost_usd: parseFloat(String(project.cost_usd || '0')) + API_COSTS.wavespeedChat,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logger.error({ err: updateError, projectId: id, route: '/api/projects/[id]/regenerate-field' }, 'Error updating product_data');
      return NextResponse.json({ error: 'Failed to save regenerated field' }, { status: 500 });
    }

    logger.info({ projectId: id, field, route: '/api/projects/[id]/regenerate-field' }, 'Field regenerated successfully');

    return NextResponse.json({
      field,
      value: newValue,
      product_data: updatedData,
    });
  } catch (error) {
    logger.error({ err: error, projectId: id, route: '/api/projects/[id]/regenerate-field' }, 'Error regenerating field');
    return NextResponse.json(
      { error: 'Failed to regenerate field' },
      { status: 500 }
    );
  }
}
