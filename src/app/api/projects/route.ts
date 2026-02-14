import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { project } from '@/db/schema';
import { getPipelineQueue } from '@/lib/queue';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const createProjectSchema = z.object({
  productUrl: z.string().url('Must be a valid URL'),
  videoUrl: z.string().url().optional(),
  characterId: z.string().uuid().optional(),
  name: z.string().optional(),
});

export async function GET() {
  const projects = await db.query.project.findMany({
    orderBy: [desc(project.createdAt)],
    with: { character: true },
  });
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

    const [newProject] = await db
      .insert(project)
      .values({
        productUrl,
        videoUrl: videoUrl || null,
        characterId: characterId || null,
        name: name || null,
        inputMode: videoUrl ? 'video_analysis' : 'product_only',
        status: 'created',
      })
      .returning();

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
