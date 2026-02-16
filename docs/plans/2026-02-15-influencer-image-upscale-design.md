# B0.14 + R1.5.13: Influencer Image Filtering & Auto-Upscale to 4K

**Author:** PM Agent
**Date:** 2026-02-15
**Status:** Spec Complete

---

## Problem

1. **Bug**: Influencers without images appear in the WHO selection grid during `influencer_selection` (disabled but visible, showing "No image" label). This is confusing — if they can't be selected, they shouldn't be shown.

2. **Missing feature**: Influencer reference images are stored at whatever resolution the user uploads. Low-res images degrade CastingAgent keyframe quality since the AI uses the reference image for face/appearance matching. Every influencer image should be auto-upscaled to 4K on upload so the pipeline always works from high-quality references.

## Solution

### Part 1: B0.14 — Filter influencers without images from selection

**Backend:** Add `.not('image_url', 'is', null)` to the `GET /api/influencers` query. Influencers without images can still be managed on the Influencers page, but won't appear in project influencer selection.

Alternatively, add a query parameter `?hasImage=true` so the list endpoint can serve both the management page (show all) and the selection picker (show only with images). Recommended: use query parameter approach for flexibility.

**Frontend:** Remove the disabled-state card rendering for imageless influencers in the WHO grid (they simply won't be in the response).

### Part 2: R1.5.13 — Auto-upscale to 4K on image change

**Flow:**

```
User uploads image → API saves original as image_url
                   → API sets upscale_status = 'processing'
                   → Enqueue BullMQ 'upscale-influencer-image' job
                   → Worker calls WaveSpeedClient.upscaleImage(image_url, { targetResolution: '4k' })
                   → Worker polls until complete
                   → Worker saves upscaled URL as image_url_4k, sets upscale_status = 'completed'
                   → Worker increments cost ($0.01)
```

**Why BullMQ instead of inline?** The WaveSpeed upscale is async (submit → poll). Doing it inline in the API route risks Vercel execution timeouts. BullMQ is already running for the pipeline — adding an upscale job type is trivial.

**Schema changes (influencer table):**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `image_url_4k` | text | null | Upscaled 4K image URL from WaveSpeed |
| `upscale_status` | text | null | null / 'processing' / 'completed' / 'failed' |
| `upscale_task_id` | text | null | WaveSpeed task ID for polling |

**Image resolution priority everywhere:** `image_url_4k ?? image_url`

This applies to:
- WHO selection grid (`project-detail.tsx`)
- Influencer list page (`influencer-list.tsx`)
- Influencer detail page (`influencer-detail.tsx`)
- Project header influencer thumbnail (`project-detail.tsx`)
- CastingAgent reference image input (`casting-agent.ts`)

**API changes:**

1. `GET /api/influencers` — Add `?hasImage=true` query param filter. Returns `image_url_4k` field. Influencer selection UI passes `hasImage=true`.

2. `POST /api/influencers` — After saving `image_url`, enqueue upscale job if image was provided. Return influencer with `upscale_status: 'processing'`.

3. `PATCH /api/influencers/[id]` — When `image_url` changes, clear old `image_url_4k`, set `upscale_status = 'processing'`, enqueue new upscale job.

4. `GET /api/influencers/[id]` — Returns `image_url_4k` and `upscale_status` (no change needed, `select('*')` already returns all columns).

**Worker changes:**

New job type `upscale-influencer-image` in the BullMQ worker:
- Input: `{ influencerId, imageUrl }`
- Process: Call `wavespeed.upscaleImage(imageUrl, { targetResolution: '4k', outputFormat: 'png' })`
- Poll: Use existing `wavespeed.pollResult(taskId)` pattern
- On success: Update influencer `image_url_4k`, `upscale_status = 'completed'`
- On failure: Set `upscale_status = 'failed'`, log error
- Cost: Track $0.01 (not per-project, just operational cost — log only)

**Frontend changes:**

- WHO selection grid: Fetch with `?hasImage=true`. Show upscale status badge if `upscale_status === 'processing'` (small spinner on image corner).
- Influencer detail page: Show "4K" badge on image when `image_url_4k` exists. Show "Upscaling..." spinner when processing.
- All image references: Use `influencer.image_url_4k || influencer.image_url` pattern.

## Acceptance Criteria

### B0.14
- [ ] `GET /api/influencers?hasImage=true` excludes influencers where `image_url IS NULL`
- [ ] WHO selection grid passes `hasImage=true` — no "No image" cards shown
- [ ] Influencers management page (`/influencers`) still shows all influencers (no filter)

### R1.5.13
- [ ] New columns `image_url_4k`, `upscale_status`, `upscale_task_id` added to `influencer` table
- [ ] Creating an influencer with an image enqueues an upscale job
- [ ] Updating an influencer's image clears old `image_url_4k` and enqueues new upscale job
- [ ] Worker processes upscale job: calls WaveSpeed, polls, saves 4K URL
- [ ] Worker handles upscale failure gracefully (sets status='failed', logs error)
- [ ] WHO selection shows 4K image when available, falls back to original
- [ ] Influencer list/detail shows 4K image when available
- [ ] CastingAgent uses 4K image when available for reference
- [ ] Upscale status indicator visible on influencer detail (processing spinner or "4K" badge)
- [ ] Cost tracked at $0.01 per upscale in generation_log

## Affected Files

**Backend:**
- `src/app/api/influencers/route.ts` — GET filter, POST enqueue upscale
- `src/app/api/influencers/[id]/route.ts` — PATCH enqueue upscale on image change
- `src/workers/pipeline.worker.ts` — New `upscale-influencer-image` job handler
- `src/lib/constants.ts` — New job type constant
- `src/db/schema.ts` — Schema doc update (image_url_4k, upscale_status, upscale_task_id)

**Frontend:**
- `src/components/project-detail.tsx` — WHO grid uses `hasImage=true`, show 4K image
- `src/components/influencer-list.tsx` — Show 4K image, upscale badge
- `src/components/influencer-detail.tsx` — Show 4K image, upscale status
- `src/agents/casting-agent.ts` — Use `image_url_4k ?? image_url` for reference

**Migration:**
- Add `image_url_4k`, `upscale_status`, `upscale_task_id` columns to `influencer` table

## Cost Impact

$0.01 per influencer image upload/change. Negligible — a user with 20 influencers spends $0.20 total on upscaling.

## PARALLEL WORK ANALYSIS

```
- Task A (backend migration): Independent, can start immediately
  Files: Supabase migration (new columns)

- Task B (backend API + worker): Depends on Task A (needs new columns)
  Files: src/app/api/influencers/route.ts, src/app/api/influencers/[id]/route.ts,
         src/workers/pipeline.worker.ts, src/lib/constants.ts, src/db/schema.ts

- Task C (frontend): Depends on Task A (needs new columns in API response)
  Files: src/components/project-detail.tsx, src/components/influencer-list.tsx,
         src/components/influencer-detail.tsx

- Task D (casting agent): Independent of B/C but needs Task A
  Files: src/agents/casting-agent.ts

Recommendation: Run migration first (Task A), then dispatch B + C + D in parallel.
In practice: Backend agent handles A + B + D (all server-side). Frontend agent handles C.
Dispatch backend first, then frontend after backend confirms new columns exist.
```
