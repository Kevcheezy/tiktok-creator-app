import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[id]/assets/regenerate
 *
 * Regenerates a single asset (or cascade of subsequent keyframes) by marking
 * them as 'generating' and enqueuing a targeted regeneration job in BullMQ.
 *
 * Body: { assetId: string, cascade?: boolean }
 *
 * When cascade=true for a keyframe asset, all subsequent keyframes in the chain
 * are also marked generating and regenerated sequentially to maintain visual
 * continuity (each uses the previous frame as reference input).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { assetId, cascade = false } = body;

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

    // Verify asset belongs to this project (include scene for segment info)
    const { data: asset, error: fetchError } = await supabase
      .from('asset')
      .select('id, type, status, scene_id, scene:scene(segment_index)')
      .eq('id', assetId)
      .eq('project_id', id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Only allow regenerating assets that aren't currently in progress
    if (!['failed', 'rejected', 'completed', 'cancelled'].includes(asset.status)) {
      return NextResponse.json(
        { error: 'Can only regenerate failed, rejected, completed, or cancelled assets' },
        { status: 400 }
      );
    }

    const isKeyframe = asset.type === 'keyframe_start' || asset.type === 'keyframe_end';

    if (cascade && isKeyframe) {
      // Cascade mode: find all subsequent keyframes and mark them generating
      const sceneData = Array.isArray(asset.scene) ? asset.scene[0] : asset.scene;
      const sourceSegment = sceneData?.segment_index ?? -1;
      const sourceIsStart = asset.type === 'keyframe_start';

      // Fetch all keyframe assets for this project with scene info
      const { data: allKeyframes } = await supabase
        .from('asset')
        .select('id, type, status, scene_id, scene:scene(segment_index)')
        .eq('project_id', id)
        .in('type', ['keyframe_start', 'keyframe_end']);

      // Find subsequent keyframes (including the target itself)
      const subsequent = (allKeyframes || []).filter((kf: any) => {
        const kfScene = Array.isArray(kf.scene) ? kf.scene[0] : kf.scene;
        const seg = kfScene?.segment_index ?? -1;
        // Include the target asset itself
        if (kf.id === assetId) return true;
        // Everything after target segment
        if (seg > sourceSegment) return true;
        // Same segment: if target is START, include END
        if (seg === sourceSegment && sourceIsStart && kf.type === 'keyframe_end') return true;
        return false;
      });

      // Mark all subsequent as generating
      const subsequentIds = subsequent.map((kf: any) => kf.id);
      if (subsequentIds.length > 0) {
        await supabase
          .from('asset')
          .update({ status: 'generating', url: null, updated_at: new Date().toISOString() })
          .in('id', subsequentIds);
      }

      // Invalidate stale video previews for all affected scenes
      const affectedSceneIds = [...new Set(subsequent.map((kf: any) => kf.scene_id))];
      if (affectedSceneIds.length > 0) {
        const { data: staleVideos } = await supabase
          .from('asset')
          .select('id')
          .eq('project_id', id)
          .eq('type', 'video')
          .in('scene_id', affectedSceneIds)
          .in('status', ['completed', 'generating']);

        if (staleVideos?.length) {
          const staleVideoIds = staleVideos.map((v: any) => v.id);
          await supabase
            .from('asset')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .in('id', staleVideoIds);

          logger.info(
            { projectId: id, cancelledVideos: staleVideoIds.length, route: '/api/projects/[id]/assets/regenerate' },
            'Cancelled stale video previews due to cascade keyframe regeneration'
          );
        }
      }

      // Enqueue cascade regeneration job
      await getPipelineQueue().add('regenerate_asset_cascade', {
        projectId: id,
        assetId,
        step: 'regenerate_asset_cascade',
        cascade: true,
      });

      logger.info(
        { projectId: id, assetId, cascadeCount: subsequentIds.length, route: '/api/projects/[id]/assets/regenerate' },
        'Cascade keyframe regeneration enqueued'
      );

      return NextResponse.json({
        message: 'Cascade regeneration started',
        assetId,
        cascadeCount: subsequentIds.length,
        affectedAssets: subsequentIds,
      });
    }

    // Non-cascade: single asset regeneration
    await supabase
      .from('asset')
      .update({ status: 'generating', url: null, updated_at: new Date().toISOString() })
      .eq('id', assetId);

    // Invalidate stale video previews for the same scene
    if (isKeyframe) {
      const { data: staleVideos } = await supabase
        .from('asset')
        .select('id')
        .eq('scene_id', asset.scene_id)
        .eq('type', 'video')
        .in('status', ['completed', 'generating']);

      if (staleVideos?.length) {
        await supabase
          .from('asset')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .in('id', staleVideos.map((v: any) => v.id));

        logger.info(
          { projectId: id, cancelledVideos: staleVideos.length, route: '/api/projects/[id]/assets/regenerate' },
          'Cancelled stale video previews due to keyframe regeneration'
        );
      }
    }

    await getPipelineQueue().add('regenerate_asset', {
      projectId: id,
      assetId,
      step: 'regenerate_asset',
    });

    return NextResponse.json({ message: 'Regeneration started', assetId });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/assets/regenerate' }, 'Error starting regeneration');
    return NextResponse.json({ error: 'Failed to start regeneration' }, { status: 500 });
  }
}
