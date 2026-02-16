/**
 * Direct-to-storage upload helper.
 * Bypasses Vercel's 4.5 MB API route body limit by uploading directly
 * to Supabase Storage via signed URLs.
 *
 * Flow: POST /api/storage/upload-url → PUT to signed URL → return storagePath
 */

type EntityType = 'influencer' | 'product' | 'project-product';

export async function uploadToStorage(
  file: File,
  entityType: EntityType,
  entityId: string,
): Promise<{ path: string; publicUrl: string }> {
  // 1. Get a signed upload URL from our API
  const urlRes = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType,
      entityId,
      contentType: file.type,
    }),
  });

  if (!urlRes.ok) {
    const data = await urlRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to get upload URL (${urlRes.status})`);
  }

  const { signedUrl, path, publicUrl } = await urlRes.json();

  // 2. PUT the file directly to Supabase Storage
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Storage upload failed (${uploadRes.status})`);
  }

  return { path, publicUrl };
}
