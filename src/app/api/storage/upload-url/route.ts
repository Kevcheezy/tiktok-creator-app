import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  isAllowedImageType,
  generateUploadPath,
  createSignedUploadUrl,
  getPublicUrl,
  type EntityType,
} from '@/lib/storage';

const UploadUrlSchema = z.object({
  entityType: z.enum(['influencer', 'product', 'project-product']),
  entityId: z.string().uuid(),
  contentType: z.string().refine(isAllowedImageType, {
    message: 'Content type must be image/jpeg, image/png, image/webp, or image/gif',
  }),
});

/**
 * POST /api/storage/upload-url
 *
 * Generates a signed upload URL for direct browser-to-storage uploads.
 * This bypasses Vercel's 4.5MB body size limit by letting the frontend
 * upload directly to Supabase Storage.
 *
 * Request body:
 *   { entityType, entityId, contentType }
 *
 * Response:
 *   { signedUrl, token, path, publicUrl }
 *
 * Frontend flow:
 *   1. Call this endpoint to get a signed URL
 *   2. PUT the file directly to the signed URL
 *   3. Call the relevant entity API (e.g., PATCH /api/influencers/:id)
 *      with { storagePath: path } to update the DB record
 */
export async function POST(request: NextRequest) {
  const route = '/api/storage/upload-url';

  try {
    const body = await request.json();
    const parsed = UploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { entityType, entityId, contentType } = parsed.data;
    const path = generateUploadPath(entityType as EntityType, entityId, contentType);

    const { signedUrl, token } = await createSignedUploadUrl(path);
    const publicUrl = getPublicUrl(path);

    logger.info({ entityType, entityId, path, route }, 'Signed upload URL created');

    return NextResponse.json({
      signedUrl,
      token,
      path,
      publicUrl,
    });
  } catch (error) {
    logger.error({ err: error, route }, 'Error creating signed upload URL');
    return NextResponse.json(
      { error: 'Failed to create signed upload URL' },
      { status: 500 }
    );
  }
}
