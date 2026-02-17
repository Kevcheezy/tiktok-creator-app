import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { createSignedUploadUrl, getPublicUrl } from '@/lib/storage';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const AssetUploadUrlSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  contentType: z.string().refine(
    (ct) => ALLOWED_CONTENT_TYPES.includes(ct),
    { message: `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` }
  ),
  filename: z.string().optional(),
});

/**
 * POST /api/storage/asset-upload-url
 *
 * Generates a signed upload URL for direct browser-to-storage asset uploads.
 * Supports both image and video content types for asset replacement.
 *
 * Request body: { projectId, assetId, contentType, filename? }
 * Response: { signedUrl, path, publicUrl }
 */
export async function POST(request: NextRequest) {
  const route = '/api/storage/asset-upload-url';

  try {
    const body = await request.json();
    const parsed = AssetUploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { projectId, assetId, contentType } = parsed.data;
    const ext = EXTENSION_MAP[contentType] || 'bin';
    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const path = `assets/uploads/${projectId}/${assetId}-${uniqueSuffix}.${ext}`;

    const { signedUrl } = await createSignedUploadUrl(path);
    const publicUrl = getPublicUrl(path);

    logger.info({ projectId, assetId, path, route }, 'Signed asset upload URL created');

    return NextResponse.json({
      signedUrl,
      path,
      publicUrl,
    });
  } catch (error) {
    logger.error({ err: error, route }, 'Error creating signed asset upload URL');
    return NextResponse.json(
      { error: 'Failed to create signed upload URL' },
      { status: 500 }
    );
  }
}
