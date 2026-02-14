import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { project } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const proj = await db.query.project.findFirst({
    where: eq(project.id, id),
    with: {
      character: true,
      scriptTemplate: true,
    },
  });

  if (!proj) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(proj);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const [updated] = await db
      .update(project)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}
