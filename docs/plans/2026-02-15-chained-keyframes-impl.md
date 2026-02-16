# Chained Keyframe Generation + 4K Reference Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure visual consistency across all 4 video segments by chaining keyframe generation (end frame → next segment) and upscaling influencer images to 4K at upload time.

**Architecture:** Add inline 4K upscaling to influencer upload routes (matching product image pattern). Rewrite CastingAgent's segment loop from parallel-independent to sequential-chained, where each segment's end keyframe URL is prepended to the next segment's reference images array.

**Tech Stack:** Supabase (PostgreSQL), WaveSpeed API (image upscaler + Nano Banana Pro edit), Next.js API routes

---

### Task 1: Add cost_usd column to influencer table

**Files:**
- Supabase migration (via MCP)

**Step 1: Apply migration**

```sql
ALTER TABLE influencer ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4) DEFAULT 0;
```

**Step 2: Verify**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'influencer' AND column_name = 'cost_usd';
```

Expected: 1 row returned.

---

### Task 2: Add 4K upscale to influencer POST route

**Files:**
- Modify: `src/app/api/influencers/route.ts`

**Step 1: Add upscale logic**

Import WaveSpeedClient and API_COSTS. After image URL is resolved (both storagePath and legacy paths), add upscale block:

```typescript
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';

const wavespeed = new WaveSpeedClient();
```

After image_url is set on the influencer, before returning:

```typescript
// Upscale to 4K (non-fatal)
if (finalImageUrl) {
  try {
    logger.info({ influencerId: influencer.id }, 'Upscaling influencer image to 4K');
    const { taskId } = await wavespeed.upscaleImage(finalImageUrl, {
      targetResolution: '4k',
      outputFormat: 'png',
    });
    const result = await wavespeed.pollResult(taskId, {
      maxWait: 60000,
      initialInterval: 3000,
    });
    if (result.url) {
      await supabase
        .from('influencer')
        .update({ image_url: result.url, cost_usd: API_COSTS.imageUpscaler })
        .eq('id', influencer.id);
      logger.info({ influencerId: influencer.id, taskId }, 'Influencer image upscaled to 4K');
    }
  } catch (upscaleErr) {
    logger.error({ err: upscaleErr, influencerId: influencer.id }, 'Influencer image upscale failed, using original');
  }
}
```

Refactor the POST handler to track `finalImageUrl` through both storagePath and legacy upload paths, then run upscale once at the end before returning.

**Step 2: Verify build**

Run: `npm run build`

---

### Task 3: Add 4K upscale to influencer PATCH route

**Files:**
- Modify: `src/app/api/influencers/[id]/route.ts`

**Step 1: Add upscale logic**

Same pattern as POST. Import WaveSpeedClient and API_COSTS. After image_url is updated (storagePath or legacy), upscale:

```typescript
// Upscale to 4K (non-fatal)
if (hasNewImage && updates.image_url) {
  try {
    logger.info({ influencerId: id }, 'Upscaling influencer image to 4K');
    const { taskId } = await wavespeed.upscaleImage(updates.image_url, {
      targetResolution: '4k',
      outputFormat: 'png',
    });
    const result = await wavespeed.pollResult(taskId, {
      maxWait: 60000,
      initialInterval: 3000,
    });
    if (result.url) {
      updates.image_url = result.url;
      // Track upscale cost
      const { data: currentInf } = await supabase
        .from('influencer')
        .select('cost_usd')
        .eq('id', id)
        .single();
      const currentCost = parseFloat(currentInf?.cost_usd || '0');
      updates.cost_usd = (currentCost + API_COSTS.imageUpscaler).toFixed(4);
    }
  } catch (upscaleErr) {
    logger.error({ err: upscaleErr, influencerId: id }, 'Influencer image upscale failed, using original');
  }
}
```

This runs before the final `supabase.update(updates)` call so the upscaled URL goes into the same update.

**Step 2: Verify build**

Run: `npm run build`

---

### Task 4: Rewrite CastingAgent — sequential chained generation

**Files:**
- Modify: `src/agents/casting-agent.ts` (the `run()` method, lines 14-224)

This is the core change. Rewrite the segment loop from independent to chained.

**Step 1: Add continuity prompt constant**

```typescript
const CONTINUITY_PROMPT = 'CONTINUITY: This frame continues directly from the previous segment. Preserve the exact same person, room, lighting, and wardrobe. Only change: pose, energy level, and product visibility as specified.';
```

**Step 2: Rewrite the segment loop**

Replace the current loop (lines 82-215) with sequential chaining:

```typescript
let segmentsCompleted = 0;
let previousEndFrameUrl: string | null = null;

for (const segIdx of SEGMENTS) {
  const scene = latestScenes.get(segIdx);
  if (!scene) {
    this.log(`Scene for segment ${segIdx} not found, skipping`);
    continue;
  }

  const defaultPlacement = PRODUCT_PLACEMENT_ARC[segIdx];
  const userOverride = customPlacement?.find((p) => p.segment === segIdx);
  const placement = userOverride
    ? {
        ...defaultPlacement,
        visibility: userOverride.visibility || defaultPlacement.visibility,
        description: userOverride.notes
          ? `${defaultPlacement.description}. User note: ${userOverride.notes}`
          : defaultPlacement.description,
      }
    : defaultPlacement;
  const energyArc = ENERGY_ARC[segIdx];

  const maxRetries = 1;
  let segmentSuccess = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        this.log(`Retry ${attempt}/${maxRetries} for segment ${segIdx} after 5s delay...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Generate visual prompts via LLM
      const sealSegment = project.video_analysis?.segments?.[segIdx] || null;
      const hasProductRef = !!productImageUrl;
      const promptPair = await this.generateVisualPrompts(
        appearance, wardrobe, sceneDescription,
        scene, placement, energyArc,
        project.product_name || 'the product',
        projectId,
        useInfluencer || hasProductRef || !!previousEndFrameUrl,
        sealSegment,
        interactionDescription,
        hasProductRef,
        segIdx > 0,  // isContinuation flag
      );

      // Save visual prompts to scene
      await this.supabase
        .from('scene')
        .update({ visual_prompt: promptPair })
        .eq('id', scene.id);

      // Build reference images: chain previous end frame + influencer + product
      const referenceImages: string[] = [];
      if (previousEndFrameUrl) referenceImages.push(previousEndFrameUrl);
      if (useInfluencer) referenceImages.push(influencer.image_url);
      if (productImageUrl) referenceImages.push(productImageUrl);

      let startUrl = '';
      let endUrl = '';

      if (referenceImages.length > 0) {
        // Edit mode: use reference images
        const editOpts = { aspectRatio: RESOLUTION.aspectRatio, resolution: '1k' as const };

        // Generate start + end keyframes in parallel (they don't depend on each other)
        this.log(`Generating keyframes (edit) for segment ${segIdx} (attempt ${attempt + 1})`);
        const [startResult, endResult] = await Promise.all([
          this.wavespeed.editImage(referenceImages, promptPair.start, editOpts),
          this.wavespeed.editImage(referenceImages, promptPair.end, editOpts),
        ]);

        await Promise.all([
          this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId, 'nano-banana-pro-edit'),
          this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId, 'nano-banana-pro-edit'),
        ]);

        // Poll both in parallel
        const [startPoll, endPoll] = await Promise.all([
          this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 }),
          this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 }),
        ]);

        startUrl = startPoll.url || '';
        endUrl = endPoll.url || '';

        await Promise.all([
          this.updateAssetUrl(startResult.taskId, startUrl),
          this.updateAssetUrl(endResult.taskId, endUrl),
        ]);

        await this.trackCost(projectId, API_COSTS.nanoBananaProEdit * 2);
      } else {
        // Text-to-image for segment 0 when no references exist
        const imgOpts = { aspectRatio: RESOLUTION.aspectRatio, width: RESOLUTION.width, height: RESOLUTION.height };

        const [startResult, endResult] = await Promise.all([
          this.wavespeed.generateImage(promptPair.start, imgOpts),
          this.wavespeed.generateImage(promptPair.end, imgOpts),
        ]);

        await Promise.all([
          this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId),
          this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId),
        ]);

        const [startPoll, endPoll] = await Promise.all([
          this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 }),
          this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 }),
        ]);

        startUrl = startPoll.url || '';
        endUrl = endPoll.url || '';

        await Promise.all([
          this.updateAssetUrl(startResult.taskId, startUrl),
          this.updateAssetUrl(endResult.taskId, endUrl),
        ]);

        await this.trackCost(projectId, API_COSTS.nanoBananaPro * 2);
      }

      // Chain: pass this segment's end frame URL to next segment
      if (endUrl) {
        previousEndFrameUrl = endUrl;
        this.log(`Segment ${segIdx} end frame chained for next segment`);
      }

      segmentSuccess = true;
      segmentsCompleted++;
      break;
    } catch (error) {
      // ... existing error handling ...
    }
  }

  if (!segmentSuccess) {
    // ... existing failed asset creation ...
    // NOTE: previousEndFrameUrl stays at last successful value (graceful degradation)
  }
}
```

**Key differences from current code:**
1. `previousEndFrameUrl` tracks the chain
2. Reference images: `[previousEndFrameUrl, influencer, product]` — previous frame FIRST
3. Start + end generated in parallel within each segment (they don't chain to each other)
4. Segments are sequential (the for loop is naturally sequential, no Promise.all across segments)
5. If a segment fails, `previousEndFrameUrl` keeps its last value — next segment still gets some reference

**Step 3: Verify build**

Run: `npm run build`

---

### Task 5: Add continuity flag to generateVisualPrompts

**Files:**
- Modify: `src/agents/casting-agent.ts` (the `generateVisualPrompts()` method)

**Step 1: Add isContinuation parameter**

Add `isContinuation: boolean = false` to the method signature.

When `isContinuation` is true, prepend to the user prompt:

```typescript
if (isContinuation) {
  enrichedUserPrompt = `${CONTINUITY_PROMPT}\n\n${enrichedUserPrompt}`;
}
```

Also update the system prompt for edit mode when continuing:

```typescript
const continuityNote = isContinuation
  ? '\nThe FIRST reference image is the previous segment\'s end frame. Preserve its exact appearance — same person, room, lighting, wardrobe. Evolve only the pose and energy.'
  : '';
```

Add this to the edit system prompt after the consistency rule.

**Step 2: Verify build**

Run: `npm run build`

---

### Task 6: Update roadmap and commit

**Files:**
- Modify: `docs/ENGINEERING_ROADMAP.md`

**Step 1: Update roadmap items**

- R1.5.11: Mark as superseded by chaining approach, update description
- R1.5.13: Mark as DONE (simplified — inline upscale at upload time)
- Check off all sub-items

**Step 2: Commit and push**

```bash
git add -A
git commit -m "feat: chained keyframe generation + 4K influencer upscale (R1.5.11 + R1.5.13)"
git push
```
