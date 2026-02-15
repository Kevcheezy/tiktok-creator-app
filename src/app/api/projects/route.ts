import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { TONE_IDS } from '@/lib/constants';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createProjectSchema = z.object({
  productUrl: z.string().url('Must be a valid URL'),
  videoUrl: z.string().url().optional(),
  influencerId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  name: z.string().optional(),
  tone: z.enum(TONE_IDS as [string, ...string[]]).optional().default('reluctant-insider'),
});

export async function GET() {
  const { data: projects, error } = await supabase
    .from('project')
    .select('*, character:ai_character(*)')
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

    const { productUrl, videoUrl, influencerId, characterId, name, tone } = parsed.data;

    const { data: newProject, error } = await supabase
      .from('project')
      .insert({
        product_url: productUrl,
        video_url: videoUrl || null,
        influencer_id: influencerId || null,
        character_id: characterId || null,
        name: name || null,
        tone,
        input_mode: videoUrl ? 'video_analysis' : 'product_only',
        status: 'created',
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error, route: '/api/projects' }, 'Error creating project');
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Enqueue product analysis job
    await getPipelineQueue().add('product_analysis', {
      projectId: newProject.id,
      step: 'product_analysis',
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects' }, 'Error creating project');
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
