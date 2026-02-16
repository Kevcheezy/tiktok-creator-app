import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const EditKeyframeSchema = z.object({
  assetId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
});

/**
 * POST /api/projects/[id]/keyframes/edit
 *
 * Edits a single keyframe using Nano Banana Pro Edit.
 * The existing keyframe image is sent through the edit endpoint
 * with the user's edit instructions as the prompt.
 *
 * Project must be in casting_review status.
 * Asset must be a completed keyframe (keyframe_start or keyframe_end) with a URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const route = '/api/projects/[id]/keyframes/edit';

  try {
    // Validate request body
    const body = await request.json();
    const parsed = EditKeyframeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { assetId, prompt } = parsed.data;

    // Validate project exists and is in casting_review
    const { data: project, error: projError } = await supabase
      .from('project')
      .select('id, status')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'casting_review') {
      return NextResponse.json(
        { error: `Project must be in casting_review status (current: ${project.status})` },
        { status: 400 }
      );
    }

    // Validate asset exists, belongs to this project, is a keyframe, and has a URL
    const { data: asset, error: assetError } = await supabase
      .from('asset')
      .select('id, type, url, status, scene_id')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found in this project' }, { status: 404 });
    }

    if (asset.type !== 'keyframe_start' && asset.type !== 'keyframe_end') {
      return NextResponse.json(
        { error: `Asset must be a keyframe (got: ${asset.type})` },
        { status: 400 }
      );
    }

    if (!asset.url || asset.status !== 'completed') {
      return NextResponse.json(
        { error: 'Asset must be completed with a URL to edit' },
        { status: 400 }
      );
    }

    // Set asset status to editing
    await supabase
      .from('asset')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .eq('id', assetId);

    // Enqueue the edit job
    const job = await getPipelineQueue().add('keyframe_edit', {
      projectId,
      step: 'keyframe_edit',
      assetId,
      editPrompt: prompt,
      propagate: false,
    });

    logger.info({ projectId, assetId, jobId: job.id, route }, 'Keyframe edit enqueued');

    return NextResponse.json({
      message: 'Keyframe edit enqueued',
      jobId: job.id,
      assetId,
      prompt,
    });
  } catch (error) {
    logger.error({ err: error, route }, 'Error editing keyframe');
    return NextResponse.json(
      { error: 'Failed to enqueue keyframe edit' },
      { status: 500 }
    );
  }
}
