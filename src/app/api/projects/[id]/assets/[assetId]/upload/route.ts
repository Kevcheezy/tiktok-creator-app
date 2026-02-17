import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getPublicUrl, extractStoragePath, deleteStorageFile } from '@/lib/storage';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';

const wavespeed = new WaveSpeedClient();

const VISUAL_ASSET_TYPES = ['keyframe_start', 'keyframe_end', 'video', 'broll'];
const VIDEO_EXTENSIONS = ['mp4', 'webm'];

/**
 * POST /api/projects/[id]/assets/[assetId]/upload
 *
 * Replaces an asset with a user-uploaded file. The file must already be
 * uploaded to Supabase Storage via signed URL. This endpoint resolves
 * the public URL, upscales images to 4K, cleans up old files, and
 * updates the asset record.
 *
 * Request body: { storagePath: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: projectId, assetId } = await params;
  const route = '/api/projects/[id]/assets/[assetId]/upload';

  try {
    const body = await request.json();
    const { storagePath } = body;

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json(
        { error: 'storagePath is required' },
        { status: 400 }
      );
    }

    // 1. Validate asset exists and belongs to project
    const { data: asset, error: assetError } = await supabase
      .from('asset')
      .select('id, type, url, status, project_id')
      .eq('id', assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.project_id !== projectId) {
      return NextResponse.json(
        { error: 'Asset does not belong to this project' },
        { status: 404 }
      );
    }

    // 2. Validate asset type is visual
    if (!VISUAL_ASSET_TYPES.includes(asset.type)) {
      return NextResponse.json(
        { error: `Cannot upload replacement for asset type "${asset.type}". Only visual assets (${VISUAL_ASSET_TYPES.join(', ')}) are supported.` },
        { status: 400 }
      );
    }

    // 3. Get public URL from storage path
    let finalUrl = getPublicUrl(storagePath);

    // 4. Determine if this is a video (skip upscale) or image (upscale to 4K)
    const ext = storagePath.split('.').pop()?.toLowerCase() || '';
    const isVideo = VIDEO_EXTENSIONS.includes(ext);

    if (!isVideo) {
      // 5. Upscale image to 4K via WaveSpeed
      try {
        logger.info(
          { projectId, assetId, route },
          'Upscaling uploaded asset image to 4K'
        );
        const { taskId } = await wavespeed.upscaleImage(finalUrl, {
          targetResolution: '4k',
          outputFormat: 'png',
        });
        const result = await wavespeed.pollResult(taskId, {
          maxWait: 60000,
          initialInterval: 3000,
        });
        if (result.url) {
          finalUrl = result.url;
          logger.info(
            { projectId, assetId, taskId, route },
            'Asset image upscaled to 4K'
          );
        }

        // 8. Track upscale cost on project
        await supabase.rpc('increment_project_cost', {
          p_project_id: projectId,
          p_amount: parseFloat(API_COSTS.imageUpscaler.toFixed(4)),
        });
      } catch (upscaleErr) {
        logger.error(
          { err: upscaleErr, projectId, assetId, route },
          'Asset image upscale failed, using original'
        );
      }
    }

    // 6. Delete old storage file if the previous URL is in our Supabase bucket
    if (asset.url) {
      const oldPath = extractStoragePath(asset.url as string);
      if (oldPath) {
        await deleteStorageFile(oldPath);
      }
    }

    // 7. Update asset: url, status, provider
    const { data: updated, error: updateError } = await supabase
      .from('asset')
      .update({
        url: finalUrl,
        status: 'completed',
        provider: 'upload',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error(
        { err: updateError, projectId, assetId, route },
        'Failed to update asset after upload'
      );
      return NextResponse.json(
        { error: 'Failed to update asset' },
        { status: 500 }
      );
    }

    logger.info(
      { projectId, assetId, isVideo, route },
      'Asset replaced with uploaded file'
    );

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error, projectId, assetId, route }, 'Error processing asset upload');
    return NextResponse.json(
      { error: 'Failed to process asset upload' },
      { status: 500 }
    );
  }
}
