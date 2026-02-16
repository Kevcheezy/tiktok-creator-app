# Chained Keyframe Generation + 4K Reference Images Design

**Date:** 2026-02-15
**Status:** Approved
**Role:** Backend
**Roadmap Items:** R1.5.11 (superseded by chaining), R1.5.13 (influencer 4K upscale)

## Goal

Ensure visual consistency across all 4 video segments by:
1. Upscaling influencer images to 4K at upload time (matching product image behavior)
2. Chaining keyframe generation so each segment's end frame feeds into the next segment as a reference

## Problem

Currently the CastingAgent generates all 4 segment keyframes independently. Each call to Nano Banana Pro uses only the original influencer photo + product photo as references. Despite text prompts requesting consistency, the AI produces visible drift: different room appearances, lighting shifts, face mismatches between segments.

## Solution

### Part 1: 4K Influencer Image Upscale at Upload Time (R1.5.13)

**Simplified from original roadmap spec.** Match the product image pattern: upscale inline during upload, store the final 4K URL directly in `image_url`. No separate `image_url_4k` column, no async worker job.

**Changes:**
- `POST /api/influencers` — after image upload, upscale to 4K via `WaveSpeedClient.upscaleImage()`, store upscaled URL
- `PATCH /api/influencers/[id]` — same upscale on image change
- Non-fatal: if upscale fails, keep original image (same as product image behavior)
- Track cost on influencer row (add `cost_usd` column)

### Part 2: Chained Keyframe Generation

**End→Start chain:** Each segment's end keyframe becomes a reference image for the next segment.

```
Seg 0: editImage([influencer_4k, product_4k], prompt_0) → start_0, end_0
        ↓ poll end_0 → get URL
Seg 1: editImage([end_0_url, influencer_4k, product_4k], prompt_1) → start_1, end_1
        ↓ poll end_1 → get URL
Seg 2: editImage([end_1_url, influencer_4k, product_4k], prompt_2) → start_2, end_2
        ↓ poll end_2 → get URL
Seg 3: editImage([end_2_url, influencer_4k, product_4k], prompt_3) → start_3, end_3
```

**Key architectural decisions:**
- **Sequential processing:** Segments 1-3 wait for the previous segment's end keyframe. ~4x slower but consistency is critical.
- **Reference image order:** Previous end frame FIRST (highest influence), then influencer, then product.
- **Continuity prompt:** Segments 1-3 get an additional prompt line: "CONTINUITY: This frame continues directly from the previous segment. Preserve the exact same person, room, lighting, and wardrobe."
- **Text-to-image fallback:** If no influencer/product images, Segment 0 uses generateImage, then Segments 1-3 use editImage with previous end frame as sole reference.
- **Error recovery:** If segment N fails, use the last successful end frame URL for segment N+1. If Segment 0 fails, entire casting fails.
- **Start frame optimization:** For each segment, generate start AND end via editImage in parallel (they don't depend on each other). Only the end frame feeds forward.

### Files Affected

- `src/app/api/influencers/route.ts` — POST: add upscale
- `src/app/api/influencers/[id]/route.ts` — PATCH: add upscale
- `src/agents/casting-agent.ts` — Sequential chaining, reference image ordering, continuity prompt
- `src/lib/constants.ts` — No changes needed (API_COSTS.imageUpscaler already exists)
- Supabase migration — Add `cost_usd` column to influencer table

### Cost Impact

- Influencer upscale: +$0.01 per influencer image upload (one-time)
- No change to casting costs (same number of editImage calls)
