import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const PropagateSchema = z.object({
  assetId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
});

/**
 * POST /api/projects/[id]/keyframes/propagate
 *
 * After a single keyframe edit succeeds, the frontend can call this
 * to apply the same edit prompt to all subsequent keyframes.
 *
 * "Subsequent" means all keyframes that come after the source asset,
 * ordered by segment_index (ascending) then type (start before end).
 *
 * Each subsequent keyframe is edited individually (its own image + the prompt).
 * This ensures consistency: e.g., changing a shirt color in segment 0
 * propagates that change to segments 1, 2, 3.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const route = '/api/projects/[id]/keyframes/propagate';

  try {
    const body = await request.json();
    const parsed = PropagateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { assetId: sourceAssetId, prompt } = parsed.data;

    // Validate project
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

    // Fetch the source asset to determine its position
    const { data: sourceAsset, error: srcError } = await supabase
      .from('asset')
      .select('id, type, scene_id, scene:scene(segment_index)')
      .eq('id', sourceAssetId)
      .eq('project_id', projectId)
      .single();

    if (srcError || !sourceAsset) {
      return NextResponse.json({ error: 'Source asset not found' }, { status: 404 });
    }

    const sourceSegment = (sourceAsset.scene as any)?.segment_index ?? -1;
    const sourceIsStart = sourceAsset.type === 'keyframe_start';

    // Find all keyframe assets for this project with their segment info
    const { data: allKeyframes } = await supabase
      .from('asset')
      .select('id, type, url, status, scene_id, scene:scene(segment_index)')
      .eq('project_id', projectId)
      .in('type', ['keyframe_start', 'keyframe_end'])
      .eq('status', 'completed');

    if (!allKeyframes || allKeyframes.length === 0) {
      return NextResponse.json({ error: 'No completed keyframes found' }, { status: 400 });
    }

    // Filter to "subsequent" keyframes
    const subsequent = allKeyframes.filter((kf: any) => {
      const seg = kf.scene?.segment_index ?? -1;
      if (seg > sourceSegment) return true;
      if (seg === sourceSegment) {
        // Same segment: only include end frame if source is start
        if (sourceIsStart && kf.type === 'keyframe_end') return true;
      }
      return false;
    });

    if (subsequent.length === 0) {
      return NextResponse.json({
        message: 'No subsequent keyframes to propagate to',
        editedCount: 0,
      });
    }

    // Mark all subsequent keyframes as editing
    const subsequentIds = subsequent.map((kf: any) => kf.id);
    await supabase
      .from('asset')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .in('id', subsequentIds);

    // Enqueue a propagation job
    const job = await getPipelineQueue().add('keyframe_edit', {
      projectId,
      step: 'keyframe_edit',
      assetId: sourceAssetId,
      editPrompt: prompt,
      propagate: true,
    });

    logger.info(
      { projectId, sourceAssetId, subsequentCount: subsequent.length, jobId: job.id, route },
      'Keyframe propagation enqueued'
    );

    return NextResponse.json({
      message: `Propagating edit to ${subsequent.length} subsequent keyframe(s)`,
      jobId: job.id,
      editedAssetIds: subsequentIds,
      editedCount: subsequent.length,
    });
  } catch (error) {
    logger.error({ err: error, route }, 'Error propagating keyframe edits');
    return NextResponse.json(
      { error: 'Failed to enqueue keyframe propagation' },
      { status: 500 }
    );
  }
}
