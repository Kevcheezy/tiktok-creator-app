# Asset Upload Replacement — Design

## Goal

Let users upload their own images or videos to replace any AI-generated visual asset (keyframes, videos, B-roll) anywhere in the pipeline.

## Requirements

- **Asset types:** All visual assets — `keyframe_start`, `keyframe_end`, `video`, `broll`
- **Processing:** Always upscale uploaded images to 4K via WaveSpeed ($0.01). Skip upscale for video uploads.
- **Cascade:** After uploading a keyframe replacement, offer the existing propagation dialog ("Apply to N subsequent keyframes?") — same as edit/regenerate flow.
- **Accepted formats:** Images (JPEG, PNG, WebP), Videos (MP4, WebM — only for `video` type assets)

## Backend

### New endpoint: `POST /api/projects/[id]/assets/[assetId]/upload`

**Input:** `{ storagePath: string }` (client uploads to Supabase storage first via signed URL, then sends the path)

**Flow:**
1. Validate asset belongs to project and is a visual type
2. Get public URL from storage path
3. If image: upscale to 4K via WaveSpeed ($0.01), use upscaled URL
4. Delete old storage file if previous URL is in our Supabase bucket
5. Update asset: `url = newUrl`, `status = 'completed'`, `provider = 'upload'`
6. Track upscale cost on project (`cost_usd += 0.01`)
7. Return updated asset

### Storage path pattern

`projects/{projectId}/uploads/{assetId}-{UUID}.{ext}` — new entity type in `generateUploadPath()`.

## Frontend

### AssetCard upload button

New "Upload" action in the hover overlay for visual asset types. Sits alongside Edit, Regenerate, Reject.

1. Click opens hidden `<input type="file">` file picker
2. File selected → card shows uploading spinner
3. Client calls `uploadToStorage()` → then `POST .../assets/[assetId]/upload` with `{ storagePath }`
4. Backend upscales + updates asset
5. Card refreshes with new image/video
6. For keyframes: existing cascade propagation dialog fires after completion

### VideoPreviewPanel

Add "Upload Video" option alongside "Test Generate" for the test video slot.

### Accepted file types

- `accept="image/jpeg,image/png,image/webp"` for keyframe/broll assets
- `accept="video/mp4,video/webm"` for video assets

## Cost

- Image upload: $0.01 (4K upscale)
- Video upload: $0.00 (no processing)

## Non-goals

- No drag-and-drop (file picker is sufficient)
- No undo (user regenerates to get AI version back)
- No multi-file upload (one asset at a time)
