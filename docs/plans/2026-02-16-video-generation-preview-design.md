# Video Generation Preview & Test Mode

## Overview

At `casting_review`, each segment's asset card gets an expandable "Preview & Test" panel that shows the full Kling API payload before committing $1.20. Users can iteratively refine prompts via LLM feedback, test-generate a single segment, review the result, and approve before committing to the full 4-segment directing stage. Pre-tested segments are skipped by DirectorAgent, saving cost. A per-project Fast Mode toggle auto-advances through all review gates for repeat/trusted products.

**Goal:** Minimize wasted video generation costs during testing while maintaining a smooth user experience. Catch bad prompts before they burn $4.80.

## Decisions

- **Test point:** Inline on casting review asset cards (not a new pipeline stage)
- **Preview depth:** Full technical — keyframe thumbnails, serialized prompts, shot timeline, negative prompt, cost
- **Prompt editing:** LLM re-run with user feedback (iterative loop until approved)
- **Skip approvals:** Per-project `fast_mode` toggle
- **Pre-tested segments:** DirectorAgent skips segments that already have a completed video asset

## Architecture

```
Casting Review (existing asset cards)
  → "Preview Video Prompt" button (new, per segment)
    → Expand: full technical preview panel
      → Keyframes (start + end thumbnails)
      → Main prompt (serialized)
      → 3 shot prompts on timeline (with energy levels)
      → Negative prompt (collapsible)
      → Duration, cfg_scale, cost
    → "Adjust Prompt" → feedback textarea → POST /refine → new preview
      → Loop: adjust → re-preview until happy
    → "Test Generate" ($1.20) → POST /test-generate → poll for video
      → Video player inline → review result
      → "Approve Test" → segment marked done, DirectorAgent will skip
      → OR "Regenerate" → back to prompt adjustment loop

"Approve & Continue" (existing, modified)
  → Cost display: "$3.60 remaining" (dynamic based on pre-tested count)
  → Pre-tested segments: skipped by DirectorAgent
  → Remaining segments: generated normally
```

### Fast Mode

```
project.fast_mode = true
  → Pipeline worker auto-advances through review gates:
    analysis_review → script_review → broll_review → casting_review
  → NEVER skips: asset_review (final deliverable always human-reviewed)
  → Amber "Fast Mode" badge on project card + detail header
```

## Schema

### Modify table: `scene`

Add column:
- `video_prompt_override` JSONB — stores the latest LLM-generated StructuredPrompt after user feedback. DirectorAgent uses this instead of generating fresh when present.

### Modify table: `project`

Add column:
- `fast_mode` boolean, default `false` — when true, pipeline worker auto-advances through review gates.

## API Endpoints

### `POST /api/projects/[id]/segments/[segIdx]/preview`

Generate the video prompt preview for a segment. No Kling API call — builds StructuredPrompt and serializes it.

**Logic:**
1. Fetch scene for segment index (latest version)
2. Fetch keyframe assets (start + end) for the scene
3. Check `scene.video_prompt_override` — use if present
4. Otherwise, build StructuredPrompt via DirectorAgent's `generateVideoPrompt()` method
5. Serialize via `serializeForVideo()`
6. Return full preview payload

**Response:**
```json
{
  "segmentIndex": 0,
  "startKeyframe": { "url": "https://...", "assetId": "uuid" },
  "endKeyframe": { "url": "https://...", "assetId": "uuid" },
  "structuredPrompt": {
    "subject": { "primary": "Young woman in her 20s", "emphasis": "++enthusiastic++" },
    "action": {
      "sequence": [
        { "time": "0-5s", "action": "Reaches toward product", "energy": "LOW" },
        { "time": "5-10s", "action": "Picks up product, shows to camera", "energy": "PEAK" },
        { "time": "10-15s", "action": "Sets product down, points confidently", "energy": "LOW" }
      ],
      "energy_arc": "LOW → PEAK → LOW"
    },
    "camera_specs": { "shot": "medium", "movement": "static" },
    "environment": { "setting": "Kitchen counter", "product_visible": true },
    "lighting": { "type": "Ring light", "quality": "Warm glow" },
    "style": { "aesthetic": "Authentic product review", "quality": "1080p" },
    "negative_prompt": "camera movement, zoom, pan..."
  },
  "serialized": {
    "prompt": "Kitchen counter, medium shot, static camera. Enthusiastic speaking. Ring light, warm glow. Authentic product review, 1080p.",
    "multiPrompt": [
      { "prompt": "Reaches toward product. Energy: LOW. Camera follows subject naturally.", "duration": "5" },
      { "prompt": "Picks up product, shows to camera. Energy: PEAK. Camera follows subject naturally.", "duration": "5" },
      { "prompt": "Sets product down, points confidently. Energy: LOW. Camera follows subject naturally.", "duration": "5" }
    ],
    "negativePrompt": "camera movement, zoom, pan, tilt..."
  },
  "config": {
    "duration": 15,
    "cfgScale": 0.5,
    "aspectRatio": "9:16",
    "cost": 1.20
  }
}
```

### `POST /api/projects/[id]/segments/[segIdx]/refine`

Re-run LLM with user feedback to produce a new StructuredPrompt. Saves result to `scene.video_prompt_override`.

**Request:**
```json
{
  "feedback": "Make the energy higher in shot 2, add a smile when picking up the product"
}
```

**Logic:**
1. Fetch current StructuredPrompt (from override or generate fresh)
2. Call DirectorAgent's `generateVideoPrompt()` with feedback injected into the user prompt:
   ```
   [existing prompt context]

   USER FEEDBACK — incorporate these changes:
   {feedback}

   Generate an updated StructuredPrompt that addresses the feedback while keeping other elements intact.
   ```
3. Save result to `scene.video_prompt_override`
4. Serialize and return same shape as `/preview`

**Cost:** $0.01 per call (WaveSpeed LLM)

**Response:** Same shape as `/preview` with updated prompts.

### `POST /api/projects/[id]/segments/[segIdx]/test-generate`

Generate a single test video for one segment. Creates a real `asset` record with `type: 'video'`.

**Logic:**
1. Fetch scene, keyframes, and prompt (override or generate)
2. Call `wavespeed.generateVideo()` with the serialized prompt — identical to what DirectorAgent would send
3. Create `asset` record: `{ type: 'video', status: 'generating', provider: 'kling-3.0-pro', cost_usd: 1.20 }`
4. Poll for completion
5. Track cost via `increment_project_cost()`
6. Return asset ID + task ID for frontend polling

**Request:**
```json
{}
```
(No body needed — uses current scene prompt state)

**Response:**
```json
{
  "assetId": "uuid",
  "taskId": "kling-task-id",
  "cost": 1.20
}
```

Frontend polls `GET /api/projects/[id]/assets` to check completion status (existing polling pattern).

### `PATCH /api/projects/[id]` (existing)

Add `fast_mode` to `ALWAYS_ALLOWED` fields so it can be toggled at any time.

## DirectorAgent Changes

Add skip logic at the top of the per-segment loop:

```typescript
for (let segIdx = 0; segIdx < vm.segment_count; segIdx++) {
  const scene = latestScenes.get(segIdx);
  if (!scene) continue;

  // NEW: Check if segment already has a completed test video
  const { data: existingVideo } = await this.supabase
    .from('asset')
    .select('id')
    .eq('scene_id', scene.id)
    .eq('type', 'video')
    .eq('status', 'completed')
    .limit(1);

  if (existingVideo && existingVideo.length > 0) {
    this.log(`Segment ${segIdx} already has approved test video (${existingVideo[0].id}), skipping`);
    continue;
  }

  // NEW: Check for video_prompt_override
  const promptOverride = scene.video_prompt_override as StructuredPrompt | null;
  if (promptOverride && isStructuredPrompt(promptOverride)) {
    // Use override directly — skip LLM prompt generation
    const serialized = serializeForVideo(promptOverride, String(vm.shot_duration));
    mainPrompt = serialized.prompt;
    multiPrompt = vm.supports_multi_prompt ? serialized.multiPrompt : [];
    effectiveNegativePrompt = serialized.negativePrompt;
  } else {
    // Existing prompt generation logic (LLM or legacy)
  }

  // ... rest of generation + retry logic unchanged
}
```

## Pipeline Worker Fast Mode Changes

In the worker, after each stage completes and before pausing at a review gate:

```typescript
// After stage completion, check if next status is a review gate
const FAST_MODE_SKIPPABLE = ['analysis_review', 'script_review', 'broll_review', 'casting_review'];

async function maybeAutoAdvance(projectId: string, nextStatus: string, correlationId: string) {
  const { data: project } = await supabase
    .from('project')
    .select('fast_mode')
    .eq('id', projectId)
    .single();

  if (project?.fast_mode && FAST_MODE_SKIPPABLE.includes(nextStatus)) {
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'fast_mode_skip', agent_name: 'Worker', stage: nextStatus,
      detail: { skippedGate: nextStatus },
    });

    // Enqueue next step immediately
    const nextStepMap: Record<string, string> = {
      analysis_review: 'scripting',
      script_review: 'broll_planning',
      broll_review: 'influencer_selection', // still needs influencer, can't skip
      casting_review: 'directing',
    };
    // ... enqueue logic
  }
}
```

**Gates never skipped even in fast mode:**
- `influencer_selection` — requires user to pick an influencer (can't auto-select)
- `asset_review` — final deliverable, always human-reviewed

## Frontend Changes

### Casting Review: Per-Segment Preview Panel

New expandable section below each segment's keyframe cards:

1. **"Preview Video Prompt" button** — chevron toggle, expands the preview panel
2. **Keyframe thumbnails** — start + end side by side (already available on the card)
3. **Main prompt** — full serialized text in a styled code block
4. **Shot timeline** — 3 cards in a row, each showing: time range, action description, energy badge (LOW/PEAK/HIGH with color)
5. **Negative prompt** — collapsible section, muted text
6. **Config bar** — duration (15s), cfg_scale (0.5), aspect ratio (9:16), cost ($1.20)
7. **Action buttons:**
   - "Adjust Prompt" → opens feedback textarea + "Refine" button → calls `/refine` → updates preview
   - "Test Generate ($1.20)" → calls `/test-generate` → shows generating spinner → video player on completion
   - "Approve Test" (after video generated) → marks segment as done
   - "Regenerate" (after video generated) → back to feedback loop

### Approve & Continue (modified)

- Dynamic cost display: "Approve & Continue ($3.60)" — subtracts pre-tested segments
- Tooltip: "1 of 4 segments already tested. Generating remaining 3."
- If all 4 pre-tested: "Approve & Continue ($0.00)" — directing is a no-op

### Fast Mode Toggle

- Project settings panel: "Fast Mode" toggle switch
- When enabled: amber "Fast Mode" badge on project card and detail header
- Tooltip: "Review gates auto-approved. Pipeline runs without pausing."

## Cost Analysis

| Scenario | Cost | Time |
|----------|------|------|
| Current: approve blind, all 4 generate | $4.80 | 15-20 min |
| Test 1, approve rest | $4.80 ($1.20 test + $3.60 remaining) | 20-25 min |
| Test 1, catch bad prompt, refine, re-test, approve rest | $5.01 ($1.20 + $0.01 refine + $1.20 retest + $2.40 remaining) | 25-30 min |
| Test 1, bad prompt → full redo today (no preview) | $9.60 ($4.80 wasted + $4.80 retry) | 30-40 min |
| Fast mode (no testing, auto-approve) | $4.80 | 15-20 min (no review pauses) |

**Break-even:** Preview pays for itself if it prevents even 1 full-pipeline retry per 2 projects.

## Acceptance Criteria

1. User can expand a "Preview Video Prompt" panel on any segment at casting_review
2. Preview shows: keyframe thumbnails, main prompt, 3 shot prompts with timeline, negative prompt, config, cost
3. User can submit text feedback → LLM regenerates prompt → preview updates (iterative loop)
4. User can test-generate a single segment ($1.20) and watch the result inline
5. Pre-tested segments are skipped by DirectorAgent when "Approve & Continue" is clicked
6. "Approve & Continue" button shows dynamic cost based on how many segments are pre-tested
7. Fast Mode toggle in project settings auto-advances through review gates
8. Fast Mode never skips `influencer_selection` or `asset_review`
9. `scene.video_prompt_override` persists across page reloads and is used by DirectorAgent
10. All test generations tracked in `generation_log` and `project.cost_usd`
