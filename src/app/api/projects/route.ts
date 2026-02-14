import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { z } from 'zod';

const createProjectSchema = z.object({
  productUrl: z.string().url('Must be a valid URL'),
  videoUrl: z.string().url().optional(),
  characterId: z.string().uuid().optional(),
  name: z.string().optional(),
});

export async function GET() {
  const { data: projects, error } = await supabase
    .from('project')
    .select('*, character:ai_character(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing projects:', error);
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

    const { productUrl, videoUrl, characterId, name } = parsed.data;

    const { data: newProject, error } = await supabase
      .from('project')
      .insert({
        product_url: productUrl,
        video_url: videoUrl || null,
        character_id: characterId || null,
        name: name || null,
        input_mode: videoUrl ? 'video_analysis' : 'product_only',
        status: 'created',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Enqueue product analysis job
    await getPipelineQueue().add('product_analysis', {
      projectId: newProject.id,
      step: 'product_analysis',
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
