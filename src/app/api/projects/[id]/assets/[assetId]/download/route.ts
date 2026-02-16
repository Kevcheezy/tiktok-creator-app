import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[id]/assets/[assetId]/download
 *
 * Proxies asset file content with Content-Disposition: attachment header
 * to enable browser downloads for cross-origin asset URLs.
 *
 * Asset URLs come from two origins:
 * - WaveSpeed CDN (keyframes, videos) — external third-party URLs
 * - Supabase Storage (audio) — public URLs on supabase.co
 *
 * Both are cross-origin to our app, so the HTML `download` attribute
 * does not work. This endpoint fetches the file and streams it back
 * with proper download headers.
 */

const MIME_MAP: Record<string, { contentType: string; extension: string }> = {
  keyframe_start: { contentType: 'image/png', extension: 'png' },
  keyframe_end: { contentType: 'image/png', extension: 'png' },
  video: { contentType: 'video/mp4', extension: 'mp4' },
  audio: { contentType: 'audio/mpeg', extension: 'mp3' },
};

// 100 MB max — video segments can be large
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: projectId, assetId } = await params;

  try {
    // 1. Fetch asset and verify it belongs to the project
    const { data: asset, error: fetchError } = await supabase
      .from('asset')
      .select('id, project_id, type, url, status, scene:scene(segment_index, section)')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json(
        { error: 'Asset not found for this project' },
        { status: 404 }
      );
    }

    if (!asset.url) {
      return NextResponse.json(
        { error: 'Asset has no URL — it may still be generating or has failed' },
        { status: 404 }
      );
    }

    if (asset.status !== 'completed') {
      return NextResponse.json(
        { error: `Asset is not downloadable (status: ${asset.status})` },
        { status: 400 }
      );
    }

    // 2. Determine content type and filename
    const mimeInfo = MIME_MAP[asset.type] || { contentType: 'application/octet-stream', extension: 'bin' };

    // Detect actual content type from URL extension if possible
    const urlLower = asset.url.toLowerCase();
    let contentType = mimeInfo.contentType;
    let extension = mimeInfo.extension;

    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
      contentType = 'image/jpeg';
      extension = 'jpg';
    } else if (urlLower.includes('.webp')) {
      contentType = 'image/webp';
      extension = 'webp';
    } else if (urlLower.includes('.mp4')) {
      contentType = 'video/mp4';
      extension = 'mp4';
    } else if (urlLower.includes('.webm')) {
      contentType = 'video/webm';
      extension = 'webm';
    }

    const sceneArr = asset.scene as { segment_index: number; section: string }[] | null;
    const scene = sceneArr?.[0] ?? null;
    const segmentLabel = scene ? `seg${scene.segment_index}-${scene.section}` : 'asset';
    const filename = `${segmentLabel}-${asset.type}-${assetId.slice(0, 8)}.${extension}`;

    // 3. Fetch the file from the origin
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let originResponse: Response;
    try {
      originResponse = await fetch(asset.url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      logger.error(
        { assetId, projectId, url: asset.url, timeout: isTimeout },
        isTimeout ? 'Download proxy timed out fetching origin' : 'Download proxy failed to fetch origin'
      );
      return NextResponse.json(
        { error: isTimeout ? 'Timed out fetching asset from origin' : 'Failed to fetch asset from origin' },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!originResponse.ok) {
      logger.error(
        { assetId, projectId, url: asset.url, status: originResponse.status },
        'Origin returned non-OK status for download proxy'
      );
      return NextResponse.json(
        { error: `Origin returned status ${originResponse.status}` },
        { status: 502 }
      );
    }

    // 4. Check content length to prevent abuse
    const contentLength = originResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      logger.warn(
        { assetId, projectId, contentLength },
        'Asset too large for download proxy'
      );
      return NextResponse.json(
        { error: 'Asset file is too large for download' },
        { status: 413 }
      );
    }

    // 5. Use origin content type if available and more specific
    const originContentType = originResponse.headers.get('content-type');
    if (originContentType && originContentType !== 'application/octet-stream') {
      contentType = originContentType.split(';')[0].trim();
    }

    // 6. Stream the response back with download headers
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new NextResponse(originResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error(
      { err: error, assetId, projectId, route: '/api/projects/[id]/assets/[assetId]/download' },
      'Error in asset download proxy'
    );
    return NextResponse.json(
      { error: 'Failed to download asset' },
      { status: 500 }
    );
  }
}
