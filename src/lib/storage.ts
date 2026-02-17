import { supabase } from '@/db';
import { logger } from '@/lib/logger';

const BUCKET = 'assets';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
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

export type EntityType = 'influencer' | 'product' | 'project-product' | 'product-image' | 'asset-upload';

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

export function isAllowedUploadType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType) || ALLOWED_VIDEO_TYPES.includes(contentType);
}

export function generateUploadPath(
  entityType: EntityType,
  entityId: string,
  contentType: string
): string {
  const ext = EXTENSION_MAP[contentType] || 'png';
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  switch (entityType) {
    case 'influencer':
      return `influencers/${entityId}/reference-${uniqueSuffix}.${ext}`;
    case 'product':
      return `products/${entityId}/product-${uniqueSuffix}.${ext}`;
    case 'project-product':
      return `products/${entityId}/product-${uniqueSuffix}.${ext}`;
    case 'product-image':
      return `products/${entityId}/angles/${uniqueSuffix}.${ext}`;
    case 'asset-upload':
      return `projects/${entityId}/uploads/${crypto.randomUUID()}.${ext}`;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export async function createSignedUploadUrl(
  path: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    logger.error({ err: error, path }, 'Failed to create signed upload URL');
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteStorageFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    logger.warn({ err: error, path }, 'Failed to delete storage file');
  }
}

export function extractStoragePath(publicUrl: string): string | null {
  const marker = '/storage/v1/object/public/assets/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}
