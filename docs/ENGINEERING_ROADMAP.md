# MONEY PRINTER 3000 - Engineering Roadmap

**Author:** Product Management
**Date:** 2026-02-15
**Status:** MVP Ready - Pipeline functional end-to-end
**Last audit:** 2026-02-15 (full codebase audit — pipeline, agents, auth, frontend verified)

---

## Executive Summary

MONEY PRINTER 3000 is an AI-powered pipeline that produces 60-second TikTok Shop UGC videos using AI-generated influencers. The target customer is a TikTok Shop seller who wants to produce high-converting viral product videos at scale using AI avatars, drawing creative inspiration from existing viral TikTok content.

**Core value proposition:** Collapse the 3-7 day, $500-2,000 UGC creation cycle into a 15-minute, ~$5 automated pipeline with human-in-the-loop quality gates.

---

## Current State Assessment

*Last updated: 2026-02-15 (codebase audit)*

### Core Pipeline (Complete — all 6 stages functional)
- **ProductAnalyzerAgent** — Extracts structured product data from TikTok Shop URLs via WaveSpeed LLM
- **ScriptingAgent** — 4-segment, 60-second scripts with syllable validation, hook scoring (14-point), 10 tone presets
- **CastingAgent** — Keyframe image generation via WaveSpeed Nano Banana Pro, chained sequential generation (end frame → next segment reference), 4K influencer + product references, continuity prompts, per-segment retry
- **DirectorAgent** — Video generation via WaveSpeed Kling 3.0 Pro, multi-prompt support, per-segment retry
- **VoiceoverAgent** — TTS audio via ElevenLabs, Voice Design API with fallback voices, per-segment error handling
- **EditorAgent** — Final video composition via Creatomate, template-based rendering with video/audio/text slots

### Infrastructure (Complete)
- Full project scaffold: Next.js 16 App Router, Supabase (PostgreSQL + Storage), BullMQ + Upstash Redis
- Supabase Auth with middleware-enforced route protection
- BullMQ worker (Railway) with all 6 pipeline stages wired, retry logic, error recovery
- Pino structured logging with `generation_log` table, correlation IDs, API call audit trail
- Products as first-class entity: analyze once, reuse across projects, override tracking
- Cost tracking: per-API call costs, atomic increments, cost confirmation dialogs

### Frontend (Complete)
- Dark cinematic UI with pipeline visualization and progress tracking
- Full CRUD pages: projects, products, influencers (list, detail, create)
- Human review gates at analysis, script, influencer selection, casting, and asset stages
- Script versioning, per-segment editing, regeneration with feedback, script upload
- Asset review: per-segment image/video/audio preview with approve/reject/regenerate
- Final video: HTML5 player, download, copy link, recipe summary, archive to `completed_run`
- Failed pipeline recovery: retry/rollback buttons, error messaging, timeout detection

### What's Not Built
- Reference video intelligence (R1.3 — `video_url` field stored but not analyzed)
- CLI/batch mode (R3.1)
- Self-hosted rendering (R3.3)
- Multi-user/teams (R4.1)
- TikTok direct publishing (R4.2)

### Per-Video Cost Estimate (Current Architecture)
| Step | Cost |
|------|------|
| Product Analysis (LLM) | $0.01 |
| Script Generation (LLM) | $0.01 |
| B-Roll Planning (LLM) | $0.01 |
| Keyframe Images (8 images) | $0.56 |
| Video Generation (4 segments) | $4.80 |
| Voiceover (4 segments) | $0.20 |
| B-Roll Images (~12-16 images) | $0.84-1.12 |
| Final Video Render (Creatomate) | $0.50 |
| **Total per video** | **~$6.93-7.21** |

---

## Prioritized Roadmap

### Tier 0: Critical Bugs & Broken Functionality (Fix before ANY feature work)

These are shipped features that are broken or create data integrity risks. They erode trust and block testing of the existing pipeline.

#### ~~B0.1 - Asset Grading Endpoint Missing~~ FIXED
PATCH handler added to `/api/projects/[id]/assets` — accepts `{ assetId, grade }`, verifies asset ownership, updates grade.

#### ~~B0.2 - Influencer Deletion Doesn't Check Project References~~ FIXED
FK guard added: DELETE returns 409 if influencer is referenced by projects.

#### ~~B0.3 - Project Deletion While Pipeline Is Running~~ FIXED
Status guard added: DELETE returns 409 if project is in an active pipeline status.

#### ~~B0.4 - Influencer CRUD Incomplete: No Edit~~ FIXED
PATCH endpoint added for name/persona text updates (B0.4) and image re-upload/replacement (B0.11). Full CRUD complete.

#### ~~B0.8 - CastingAgent Crashes: WaveSpeed `num_images` Parameter~~ FIXED
Changed `num_images` from 1 to 2 in `wavespeed.ts`. Poll result already picks first image from the pair via `outputs?.[0]`.

#### ~~B0.9 - No Product Image Captured During Analysis~~ FIXED
- Added `product_image_url` column to `project` table (migration applied)
- Pipeline worker saves extracted image URL to project column during analysis
- Analysis review UI displays product image with preview
- Upload fallback via `POST /api/projects/[id]/product-image` (stores in Supabase Storage `assets/products/{id}/`)
- Broken/missing image shows upload prompt with amber warning styling
- Hard gate: approve button disabled without a valid product image; API returns 400 if no image present

#### ~~B0.10 - Failed Pipeline Has No Recovery Path~~ FIXED
- Added `failed_at_status` column to track which stage failed
- Pipeline worker records failed stage in all 6 error handlers
- `POST /api/projects/[id]/retry` — re-enqueues the failed stage
- `POST /api/projects/[id]/rollback` — resets to previous review gate
- Pipeline progress highlights failed stage in magenta with X icon
- FailedRecovery component with "Retry [Stage]" and "Back to [Review Gate]" buttons
- All existing work (scripts, assets, cost) preserved on both retry and rollback

#### ~~B0.11 - Influencer Image Re-upload / Replacement~~ FIXED
- PATCH `/api/influencers/[id]` now accepts FormData with optional `image` file (alongside text fields `name`, `persona`)
- Old image is deleted from Supabase Storage before uploading replacement (no orphaned blobs)
- Influencer detail page: "Replace Image" button opens file picker, shows preview with confirm/cancel before uploading
- Current image remains visible alongside the preview so users can compare before replacing
- After successful upload, influencer state updates in-place without full page reload

#### ~~B0.12 - Influencer Image Upload Fails Silently~~ FIXED
- Backend: `PATCH /api/influencers/[id]` passed raw `File` object to `supabase.storage.upload()` — incompatible in Node.js. Fixed by converting to `Buffer` via `Buffer.from(await file.arrayBuffer())` with explicit `contentType`, matching the working product-image upload pattern.
- Frontend: `catch { // silently fail }` swallowed errors. Added `uploadStatus` state with success/error feedback messages that auto-clear after 3 seconds.

#### ~~B0.5 - Project List Stale After Creation~~ FIXED
Added `router.refresh()` before navigation after project creation to invalidate the client-side Router Cache.

#### ~~B0.6 - Cost Not Tracked on Regeneration~~ FIXED
Made `BaseAgent.trackCost()` atomic via Postgres `increment_project_cost` RPC function. All agents (including regeneration paths) now use race-condition-safe cost increments.

#### ~~B0.7 - Schema Documentation Drift~~ FIXED
Updated `src/db/schema.ts` with `influencer` table, `completed_run` table, and missing columns (`tone`, `influencer_id`, `source`, `version`).

#### ~~B0.13 - Influencer Dropdown Shows Full Persona Text~~ FIXED
Influencer `<select>` options displayed the entire `persona` field (full appearance description). Truncated to name + first 4 words of persona in both `create-project-form.tsx` and `project-detail.tsx` settings panel.

#### ~~B0.15 - Generate Keyframes Requires Double-Click~~ FIXED
**Severity:** Medium (UX — first click appears to do nothing)
**Why:** `POST /api/projects/[id]/select-influencer` enqueues the casting job but did NOT update the project status from `influencer_selection` to `casting` on first selection (status only updated when re-casting from a downstream stage). The immediate `fetchProject()` call returned the stale status, and the UI stayed on the InfluencerSelection view. Consequence: users clicked multiple times, enqueuing concurrent casting jobs that each created full sets of keyframe assets (20 assets instead of 8, 15+ min generation time, $1.40 wasted).

- [x] `select-influencer/route.ts`: Always set `updateData.status = 'casting'` when confirming (not just on re-cast)
- [x] Move the `error_message`/`failed_at_status` reset into the re-cast conditional only
- [x] CastingAgent: delete existing keyframe assets before generating new ones (prevents accumulation on re-cast or duplicate jobs)

#### ~~B0.14 - Influencers Without Images Shown in Selection UI~~ FIXED
**Severity:** Low (UX confusion, not data integrity)
**Spec:** `docs/plans/2026-02-15-influencer-image-upscale-design.md` (Part 1)
**Why:** WHO selection grid at `influencer_selection` stage shows influencers without images as disabled cards with "No image" label. If they can't be selected, they shouldn't be shown. Fix: add `?hasImage=true` query param to `GET /api/influencers` and use it in the selection picker.

- [x] `GET /api/influencers?hasImage=true` filters out `image_url IS NULL`
- [x] WHO selection grid fetches with `hasImage=true`
- [x] Influencers management page still shows all influencers (no param = no filter)

#### ~~B0.15 - Build-Breaking Type Errors in Analytics & TikTok Routes~~ FIXED
**Severity:** Critical (blocks `npm run build`)
**Why:** 14 Pino logger calls in `analytics/` and `tiktok/` API routes had reversed argument order (`logger.error('msg', {obj})` instead of `logger.error({obj}, 'msg')`). Additionally, `tiktok/sync/route.ts` had: `TikTokVideoMetrics.video_id` (correct field: `id`), `computeRoi` called with 3 args (accepts 2), `computePerformanceBadge` called with wrong params. These errors were masked because earlier build failures stopped TypeScript from reaching these files. Uncovered and fixed during unrelated frontend work.

- [x] Fix Pino logger argument order in 14 calls across `analytics/breakdown`, `analytics/dashboard`, `analytics/leaderboard`, `tiktok/auth`, `tiktok/callback`, `tiktok/disconnect`, `tiktok/status`, `tiktok/sync`
- [x] Fix `metric.video_id` → `metric.id` in tiktok sync route
- [x] Fix `computeRoi(views, cost, gmv)` → `computeRoi(gmv, cost)` in tiktok sync route
- [x] Fix `computePerformanceBadge` params to match function signature

#### ~~B0.16 - Product Image Not Resolved From Linked Product Entity~~ FIXED
**Severity:** Medium (UX friction — forces unnecessary re-upload)
**Why:** When a project is created from an existing Product (R1.6), `product_image_url` is copied at creation time. If the Product's 4K upscaled image was uploaded *after* the project was created, the project's copy stays null — showing "No product image found. Upload one to continue." even though the Product has a valid image. The project detail API (`GET /api/projects/[id]`) didn't join the `product` table, so the frontend couldn't fall back to the Product's `image_url`.

- [x] Added `product:product(*)` join to `GET /api/projects/[id]` select query
- [x] Added `product_id` and `product` relation to frontend `ProjectData` interface
- [x] Product image resolution chain: `project.product_image_url → project.product?.image_url → data.product_image_url`

#### ~~B0.17 - Keyframe Edit Fails Silently (No Error Feedback)~~ FIXED
**Severity:** High (user action results in failed asset with no explanation)
**Scope:** Frontend + Backend
**Why:** When a user submits a keyframe edit via the "Edit Keyframe" dialog at casting_review, the edit is enqueued as a `keyframe_edit` BullMQ job. If the WaveSpeed Nano Banana Pro Edit API call fails (timeout, API error, or invalid image URL), the worker sets the asset to `failed` status but the user sees no error message — the dialog just closes. The user discovers the failure only by noticing the asset card shows a failed state.

**Root causes (investigated):**
- Worker `editSingleKeyframe()` had `pollResult` timeout at 120s (too short) — increased to 240s
- Error handler set asset to `failed` but didn't store error message in metadata — now writes `metadata.lastEditError`
- Extra `segIdx` argument to `generateVisualPrompts()` caused build break (14 args, max 13) — removed

**Frontend issues:**
- `handleEditSubmit()` in `asset-review.tsx:185` doesn't check `res.ok` — a 400/500 response is silently ignored
- No error toast or inline error shown when the edit job fails
- Asset card in `failed` state after edit doesn't show the failure reason or offer a "retry edit" action

**Fix checklist:**
- [x] Frontend: Check `res.ok` in `handleEditSubmit()`, show inline error in edit modal on API failure
- [x] Frontend: Show error reason on asset card when edit fails (reads `asset.metadata.lastEditError`, truncated to 120 chars)
- [x] Frontend: Add "Retry Edit" button on failed-after-edit keyframe assets (amber, opens edit dialog)
- [x] Backend: Increase `pollResult` timeout from 120s to 240s in `editSingleKeyframe()` (matching CastingAgent fix)
- [x] Backend: Store error message in `asset.metadata.lastEditError` on edit failure (both single and propagation handlers)
- [x] Backend: Fix build break — `segIdx` arg now properly accepted via `segmentIndex` param in method signature (B0.18)

#### ~~B0.18 - Identical Start/End Keyframes Per Segment~~ FIXED
**Severity:** High (visually broken video — start and end keyframes look the same)
**Scope:** Backend
**Why:** ENERGY_ARC for segments 2-4 has identical start/end energy levels (e.g., `start: 'LOW', end: 'LOW'`). The LLM prompt told the model "Generate START frame (energy: LOW) and END frame (energy: LOW)" with no other differentiation signal, so it generated nearly identical start/end keyframes. Most visible on segment 2 where the character pose, expression, and product position were indistinguishable between frames.

**Fix:**
- Added `FRAME_ACTIONS` constant to `src/lib/constants.ts` with per-segment start/end pose descriptions (body language, expression, product interaction)
- Updated `generateVisualPrompts()` in CastingAgent to accept `segmentIndex` parameter
- Injected `DIFFERENTIATION RULE` into system prompt with explicit start/end pose requirements
- Injected concrete pose cues into user prompt for both edit and text-to-image paths
- Each segment now gets distinct start/end pose directions regardless of energy arc values

#### ~~B0.19 - Per-Segment Keyframe Regeneration Broken (Missing Endpoint)~~ FIXED
**Severity:** High (user-facing button does nothing)
**Scope:** Backend
**Why:** The "Regenerate" button on failed/rejected keyframe assets calls `POST /api/projects/[id]/assets/regenerate` with `{ assetId }`. Route and worker handler already exist and are fully functional.

**Backend (already implemented):**
- [x] `src/app/api/projects/[id]/assets/regenerate/route.ts` — POST handler validates asset belongs to project, checks status, marks as `generating`, enqueues `regenerate_asset` BullMQ job
- [x] Worker `handleAssetRegeneration()` routes to `regenerateKeyframe()`/`regenerateVideo()`/`regenerateAudio()` based on asset type

**Frontend:** No changes needed — `asset-review.tsx` already calls the endpoint correctly.

#### ~~B0.20 - Keyframe Regeneration Doesn't Cascade to Dependent Keyframes~~ FIXED
**Severity:** High (regenerated keyframe breaks visual continuity of all subsequent keyframes)
**Scope:** Backend + Frontend
**Why:** Keyframes have a hard dependency chain: each keyframe is generated using the previous keyframe as a reference input to Nano Banana Pro (chained generation). When a user regenerates a keyframe (e.g., Segment 3 START), the subsequent keyframes (Segment 3 END, Segment 4 START, Segment 4 END) still reference the OLD image and become visually inconsistent — different person appearance, lighting, pose continuity broken.

**Fix:**
- Frontend already had cascade confirmation dialog with cost estimate and "Just This One" / "Regenerate All" buttons
- Extended `POST /api/projects/[id]/assets/regenerate` to accept `{ assetId, cascade: true }`, marks all subsequent keyframes as `generating`
- Added `handleCascadeRegeneration()` worker handler: walks the keyframe chain in order, passing each newly generated frame as primary reference to the next
- Rewrote `regenerateKeyframe()` to build full reference image stack (previous end frame + influencer + product image with angle-aware selection), matching the CastingAgent's original generation pattern
- Fixed poll timeout from 120s → 240s (matching CastingAgent)
- Error metadata stored in `asset.metadata.lastRegenError` for frontend display

**Fix checklist:**
- [x] Frontend: On regenerate click, count subsequent keyframes and show confirmation dialog with cascade count
- [x] Backend: Extended `POST /api/projects/[id]/assets/regenerate` to accept `{ assetId, cascade: true }`
- [x] Worker: New `handleCascadeRegeneration()` walks chain in order with frame-to-frame reference passing
- [x] Worker: `regenerateKeyframe()` now uses full reference images (previous frame, influencer, product) matching CastingAgent
- [x] Backend: Error stored in `asset.metadata.lastRegenError` on regeneration failure

#### ~~B0.21 - No Audio Duration Validation in VoiceoverAgent~~ FIXED
**Severity:** High (audio silently clips or leaves dead silence in final video)
**Scope:** Backend
**Why:** VoiceoverAgent generates TTS audio from `scene.script_text` but never measures the actual audio duration. The only validation is file size (warn if <5KB or >1MB). If ElevenLabs produces audio longer than the segment duration (possible with slower voice styles or longer scripts), the Creatomate template silently clips it. If audio is too short, there's dead silence at the segment end. Users get a broken final video with no indication of why.

**Fix checklist:**
- [x] After TTS generation, measure audio duration (128kbps MP3: `duration = buffer.length / 16000`)
- [x] Warn via `logToGenerationLog()` if audio duration is outside acceptable range (<80% or >100% of `segment_duration`)
- [x] Store measured duration in `asset.metadata.durationMs` for EditorAgent to reference
- [x] If audio exceeds segment duration by >2s, log a `segment_error` event (don't fail — but make it visible)

#### ~~B0.22 - Voice Mapping Mismatch (Every Video Gets Same Voice)~~ FIXED
**Severity:** Medium (defeats voice personalization — all categories sound identical)
**Scope:** Backend
**Why:** `VOICE_MAPPING` in VoiceoverAgent uses persona names as keys (`pharmacist`, `dermatologist`) but the lookup is by `project.product_category` (`supplements`, `skincare`, `fitness`, etc.). The fallback `VOICE_MAPPING[Object.keys(VOICE_MAPPING)[0]]` always resolves to the first key (`pharmacist`), so every product category gets the same deep/calm/professional voice regardless of the product type.

**Fix checklist:**
- [x] Add a `CATEGORY_TO_PERSONA` bridge map in `src/lib/constants.ts` that maps product categories to persona keys (e.g., `supplements` -> `pharmacist`, `skincare` -> `dermatologist`, `fitness` -> `fitness_coach`)
- [x] VoiceoverAgent: resolve voice via `CATEGORY_TO_PERSONA[category]` -> `VOICE_MAPPING[persona]`
- [x] Log which persona was selected for the category in `logToGenerationLog()` (event_type: `voice_selected`)
- [x] Ensure unmapped categories still fall back gracefully (log warning, use first persona)

#### ~~B0.23 - Data URI Audio Fallback Causes Silent Render Failures~~ FIXED
**Severity:** Medium (EditorAgent render fails with no clear error pointing to the cause)
**Scope:** Backend
**Why:** When Supabase Storage upload fails, VoiceoverAgent stores audio as `data:audio/mpeg;base64,...` in `asset.url`. EditorAgent passes this URL directly to Creatomate. Creatomate's support for data URIs as audio sources is undocumented and untested. If Creatomate rejects the data URI, the render fails with a generic error that doesn't indicate the audio format was the problem.

**Fix checklist:**
- [x] VoiceoverAgent: if Storage upload fails, treat it as a segment failure (create `status: 'failed'` asset) instead of storing a data URI
- [x] Remove the data URI fallback path entirely — it creates a time bomb for EditorAgent
- [x] Log Storage upload failures as `segment_error` events with detail (bucket, path, error message)
- [x] EditorAgent: add pre-render validation that all asset URLs are HTTPS (reject data URIs with a clear error message)

#### ~~B0.24 - BRollAgent JSON Parse Failure — No Retry on Malformed LLM Response~~ FIXED
**Severity:** High (B-roll planning KOs the entire project with no recovery)
**Scope:** Backend
**Discovered:** 2026-02-16 (PROJECT-5: Collagen Bio-Peptides Powder, NeoCell Grassfed)
**Error:** `Failed to parse B-roll LLM response: Expected ',' or '}' after property value in JSON at position 4438 (line 70 column 88)`
**Why:** The Gemini LLM returned malformed JSON in the B-roll shot list response. The BRollAgent has no recovery mechanism — a single JSON parse failure immediately KOs the project. The response was large (~4438+ chars) and likely contained unescaped characters in prompt strings or a trailing comma. The agent should retry with a cleaner/simpler prompt or attempt JSON repair before hard-failing.

**Root cause:** BRollAgent parses the raw LLM response with `JSON.parse()` — no fallback, no retry, no repair. LLMs frequently produce slightly malformed JSON (trailing commas, unescaped quotes in string values, truncated responses), and a single parse failure shouldn't be terminal.

**Fix checklist:**
- [x] Add JSON repair attempt before hard-failing (strip trailing commas, fix unclosed brackets/strings)
- [x] If `JSON.parse()` fails after repair, retry LLM call once with a simplified prompt that emphasizes strict JSON formatting
- [ ] ~~Add `JSON5.parse` or equivalent lenient parser as secondary fallback~~ — skipped per assignment (no new dependencies; string-based repair covers trailing commas)
- [x] Log the raw LLM response on parse failure (currently only logs a truncated snippet — need full response for debugging)
- [ ] Consider chunking: if the shot list is large (>20 shots), generate in batches to reduce truncation risk (deferred — not in scope for this fix)

#### ~~B0.25 - WaveSpeed API Calls Hang Indefinitely (No Fetch Timeout)~~ FIXED
**Severity:** Critical (worker process hangs forever, project stuck in casting/directing)
**Scope:** Backend
**Discovered:** 2026-02-16 (PROJECT-5: Collagen Bio-Peptides Powder — casting stuck at 2/8 keyframes)
**Root cause:** `WaveSpeedClient.request()` calls `fetch()` with no `AbortController` or timeout. When the WaveSpeed API becomes unresponsive (common under load after burst requests), the `await fetch()` never resolves. The try-catch can't fire because no error is thrown — the Promise simply never settles. Only `pollResult()` had a timeout; all other methods (`chatCompletion`, `generateImage`, `editImage`, `generateVideo`) could hang forever.
**Impact:** R1.5.19 structured prompt changes amplified this — the larger system prompts and StructuredPrompt JSON responses increase API processing time, making hangs more likely after segment 0's burst of requests.
**Fix:**
- [x] Add `AbortController` with 120s timeout to `WaveSpeedClient.request()` (covers all API methods)
- [x] Clear timeout on successful response (prevent memory leaks)
- [x] Produce clear `WaveSpeed API timeout` error message for AbortError
- [x] Add 30s timeout to individual `pollResult()` fetch calls (retries on timeout instead of hanging)
- [x] Fix abort error detection: replace `instanceof DOMException` with runtime-safe `isAbortError()` helper (Node.js compatibility — `DOMException` instanceof check unreliable across Node versions used by `tsx`)

#### B0.26 - EditorAgent Has No Retry Logic (Single Failure Kills $5+ of Work) ~~FIXED~~
**Severity:** High (elevated from Medium — final stage failure wastes $5-7 of prior API spend)
**Scope:** Backend
**Why:** DirectorAgent retries each segment 2x with 10s delay. VoiceoverAgent has per-segment try/catch. EditorAgent has zero retry logic — if the Creatomate render API returns an error or times out (5min), the entire editing stage fails immediately. This is the final stage where all previous investment ($5+ in API calls) is at stake. A transient Creatomate error wastes all that work and forces the user to manually retry from the UI.

**Fix checklist:**
- [x] Add retry loop in EditorAgent: 2 retries with 15s exponential backoff before failing
- [x] Log each retry attempt to `generation_log` (event_type: `render_retry`, detail: `{ attempt, error, delayMs }`)
- [x] On final failure, include retry count in error message so debugger knows retries were exhausted

#### B0.27 - DirectorAgent Double-Charges Cost on Retry ($2.40/segment waste) ~~FIXED~~
**Severity:** Critical (direct money waste — each retried segment charges 2-3x)
**Scope:** Backend
**Discovered:** 2026-02-16 (bug bash)
**Why:** `director-agent.ts` calls `trackCost(projectId, vm.cost_per_segment)` inside the retry loop. When a segment fails and retries, cost is tracked again on success — so a segment that took 2 attempts charges $2.40 instead of $1.20. With 4 segments and retries, a single video can overcharge by $4.80+. The cost should only be tracked once per successful asset, not per attempt.

**Fix checklist:**
- [x] Move `trackCost()` call outside the retry loop — only track on the final successful generation
- [x] Add guard: check if cost was already tracked for this segment before calling `trackCost()`
- [x] Audit BRollAgent for the same pattern (confirmed: LLM cost tracked even on parse failure, then re-tracked on retry success)
- [x] BRollAgent: move LLM cost tracking to after successful JSON parse, not before

#### B0.28 - B-Roll Stages Missing from Rollback Map (Recovery Blocked) ~~FIXED~~
**Severity:** High (users stuck on failed B-roll with no rollback path)
**Scope:** Backend
**Discovered:** 2026-02-16 (bug bash)
**Why:** `src/app/api/projects/[id]/rollback/route.ts` has a `rollbackMap` that maps each stage to its previous review gate. `broll_planning` and `broll_generation` are both missing from this map. If either B-roll stage fails, the "Roll Back" button in the UI calls the rollback endpoint, which returns an error because it can't find the stage in the map. The user is stuck with no recovery path except manual DB intervention.

**Fix checklist:**
- [x] Add `broll_planning: 'script_review'` to `rollbackMap` (rolls back to script review)
- [x] Add `broll_generation: 'broll_review'` to `rollbackMap` (rolls back to B-roll storyboard review)
- [x] Verify retry endpoint already has both stages in `stepToJob` (confirmed: it does)

#### B0.29 - Select-Influencer Race Condition Enqueues Duplicate Casting Jobs ~~FIXED~~
**Severity:** Medium (wastes $0.56+ per duplicate — CastingAgent cleans up assets but API budget is spent)
**Scope:** Backend
**Discovered:** 2026-02-16 (bug bash)
**Why:** `POST /api/projects/[id]/select-influencer` has no idempotency guard. B0.15 fixed the status update so it always sets `status: 'casting'` on first click, but there's still a window: if two requests arrive before the first DB update completes, both pass the status check, both update the project, and both enqueue casting jobs. CastingAgent does delete old keyframe assets before generating (B0.15 fix), so the second job's cleanup + regeneration isn't catastrophic — but it wastes $0.56 in WaveSpeed API calls and confuses the progress UI.

**Fix checklist:**
- [x] Add optimistic locking: `select-influencer` route should include `status` in the UPDATE's WHERE clause (e.g., `WHERE id = ? AND status = 'influencer_selection'`) — second request fails because status already changed to `casting`
- [x] Return 409 Conflict if the conditional update matches 0 rows
- [x] Frontend: disable the button after first click (defense in depth — backend guard is primary)

#### ~~B0.30 - Keyframe Reference Image Ordering Broken (Influencer Likeness Drift + Product Placement Overrides Ignored)~~ FIXED
**Severity:** High (influencer face drifts across segments, user product placement overrides from Casting Review silently ignored)
**Scope:** Backend
**Discovered:** 2026-02-16

**Why:** Four interconnected bugs in keyframe reference image handling:
1. `selectProductImageForSegment` reads from `videoModel.product_placement_arc` (default arc) instead of the merged placement that includes user overrides from Casting Review's "4. Product Placement" settings. If user enables product for segment 0, the image API never receives a product reference.
2. Reference image array ordered `[previousEndFrame, influencer, product]` — influencer buried at position 2 for segments 1+. Nano Banana Pro edit API gives more weight to earlier images, causing face/likeness drift over time.
3. End frame references included `[startFrame, previousEndFrame, influencer, product]` — 4 refs with influencer at position 3. The `previousEndFrame` is redundant since `startFrame` already incorporated it.
4. Same bugs existed in `regenerateKeyframe()` in `pipeline.worker.ts`.

**Fix checklist:**
- [x] `selectProductImageForSegment` now accepts `mergedVisibility` parameter from caller (includes user overrides)
- [x] Reference image ordering changed to: influencer FIRST (face/likeness), product second, previousEndFrame third
- [x] End frame references: startFrame first, influencer second, product third — no previousEndFrame
- [x] `regenerateKeyframe()` in pipeline worker updated with same ordering + user override support
- [x] `CONTINUITY_PROMPT` and `continuityNote` updated to reflect new reference ordering

#### ~~B0.31 - VideoPreviewPanel Retry Button Calls Wrong Handler~~ FIXED
**Severity:** Low (UX bug — retry after test-generate failure re-fetches preview instead of re-attempting generation)
**Scope:** Frontend
**Discovered:** 2026-02-16

**Why:** `loadError` state is shared between preview fetch errors and test-generate errors, but the Retry button always calls `fetchPreview`. When a test-generate fails, clicking Retry loads the prompt preview instead of re-attempting video generation.

**Fix checklist:**
- [x] Add `errorSource` state to track which operation failed (`'preview' | 'test-generate'`)
- [x] Set `errorSource` in each catch block (`fetchPreview`, `handleRefine`, `handleTestGenerate`)
- [x] Clear `errorSource` when `loadError` is cleared
- [x] Retry button dispatches to correct handler based on `errorSource`
- [x] Retry button label reflects which operation will be retried

#### ~~B0.32 - Video Prompt Missing Dialogue Text (Kling Has No Script Context)~~ FIXED
**Severity:** Medium (video generation has no awareness of spoken dialogue — gestures and lip sync can't match script)
**Scope:** Backend
**Discovered:** 2026-02-16

**Why:** `serializeForVideo()` in `src/lib/prompt-serializer.ts` reads `dialogue.delivery` (the delivery style) but completely ignores `dialogue.text` (the actual spoken script). Kling 3.0 Pro generates video without knowing what words the character is saying, so gestures, lip movements, and energy can't properly match the dialogue.

**Fix checklist:**
- [x] Add `dialogue.text` to main prompt with `Speaking: "..."` label so Kling understands it's spoken dialogue
- [x] Keep `dialogue.delivery` as-is (describes HOW the line is delivered)
- [x] Null-check `dialogue.text` since field is optional

#### ~~B0.33 - Video Regeneration Button Not Working (z-index / Event Interception)~~ FIXED
**Severity:** Medium (regenerate button visible on hover but clicks intercepted by HTML5 video controls)
**Scope:** Frontend
**Discovered:** 2026-02-21

**Why:** The hover action button container in `AssetCard` sits below the native HTML5 `<video controls>` control bar in stacking context. When user clicks the regenerate (or any action) button over a video asset, the native video controls intercept the click event before it reaches the button.

**Fix checklist:**
- [x] Add `z-10` to hover action button container so it stacks above native video controls
- [x] Add `e.stopPropagation()` to regenerate button onClick
- [x] Add `e.stopPropagation()` to all action buttons (upload, edit, reject) for consistency
- [x] Download button already had `e.stopPropagation()` — no change needed

#### ~~B0.36 - Dashboard Shows Blank Content (Projects Not Rendering)~~ FIXED
**Severity:** Critical (home page shows no projects — entire kanban board invisible)
**Scope:** Frontend
**Discovered:** 2026-02-21

**Why:** Three compounding issues made the dashboard appear blank despite data existing:
1. `page.tsx` imported the service-role Supabase client from `@/db` instead of the cookie-based SSR client from `@/lib/supabase/server`. The auth context mismatch could cause the query to fail silently.
2. Error from the Supabase query was destructured away (`{ data: projects }` without `error`). On failure, `data` is `null`, and `projects || []` passes an empty array to QuestBoard, which shows "No quests active" instead of surfacing the error.
3. The `stagger-children` CSS class used `animation-fill-mode: both`, which sets elements to `opacity: 0` before the animation fires. During SSR hydration, if the animation doesn't replay, content stays permanently invisible.
4. No `error.tsx` error boundary existed — any server component throw produced a blank page with no feedback.

**Fix checklist:**
- [x] Switch `page.tsx` to use `createClient()` from `@/lib/supabase/server` (cookie-based SSR client)
- [x] Capture `error` from Supabase query, log with `console.error`, show visible error banner
- [x] Change `stagger-children` from `both` to `forwards` fill-mode so content is visible by default
- [x] Add `@media (prefers-reduced-motion: reduce)` to disable animations for accessibility
- [x] Add `src/app/error.tsx` error boundary with retry button and styled error display

#### ~~B0.37 - Cascade Keyframe Regeneration Fails: "No visual prompt found"~~ FIXED
**Severity:** High (cascade regeneration always fails, marking all downstream keyframes as failed)
**Scope:** Backend (worker)
**Discovered:** 2026-02-21

**Why:** `handleCascadeRegeneration()` fetched all keyframes with a partial scene select (`scene:scene(id, segment_index)`), missing the `visual_prompt` field. When these assets were passed to `regenerateKeyframe()`, it read `scene.visual_prompt` which was `undefined`, throwing "No visual prompt found on scene for regeneration". Single-asset regeneration worked fine because it used `scene:scene(*)`.

**Fix checklist:**
- [x] Change cascade keyframe fetch from `scene:scene(id, segment_index)` to `scene:scene(*)` in `pipeline.worker.ts` line 1186

#### ~~B0.40 — END frame reference images use wrong order (face drift)~~ FIXED
**Severity:** Critical — causes influencer face to drift across segments
**Scope:** Backend (worker)

**Why:** Casting agent END frame references put `startUrl` at position 0 (primary identity) and influencer at position 1 (secondary). WaveSpeed API treats position 0 as the primary face/likeness reference. Over 4 segments, this causes cumulative face drift — each END looks less like the influencer.

**Fix checklist:**
- [x] Fix: Reorder both END frame reference arrays (continuation path + first segment path) to put influencer at position 0
- The B0.30 fix correctly ordered START frame references but missed END frame references

#### ~~B0.41 — Keyframe sequencing fix + JSON structured prompts~~ FIXED
**Severity:** Critical — END frames not evolving from START frames
**Scope:** Backend (agents, lib)

**Why:** B0.40 put influencer at position 0 for END frames, but Nano Banana Pro edit API treats position 0 as the base image to transform. Each END frame independently regenerated from the influencer photo instead of evolving from the START frame. Also, image prompts were serialized to flat prose losing structured specificity.

**Fix checklist:**
- [x] Reorder END frame refs: startUrl position 0 (evolve), influencer position 1 (identity anchor), product position 2
- [x] Add `serializeAsJSON()` to prompt-serializer.ts — sends structured JSON as prompt text
- [x] Switch casting agent + worker regen handler to use serializeAsJSON instead of serializeForImage
- [x] Add observability: reference images stored in asset metadata, api_call events logged to generation_log

---

### Tier 1: Complete the Core Pipeline (Ship a working end-to-end product)

These are blocking items. Nothing else matters until a user can go from product URL to finished video.

#### ~~R1.1 - Complete Asset Generation (Phase 3)~~ DONE
**Status:** Complete (2026-02-15)
**Depends on:** ~~B0.1~~ ~~B0.8~~ ~~B0.9~~ (all fixed)
**Why:** Without this, the product is a script generator, not a video creator.

**Pre-casting gate (new review step between script_review and casting):**
- [x] **Influencer selection gate:** `influencer_selection` status added between `script_review` and `casting`. User must pick an influencer with a reference image. `POST /api/projects/[id]/select-influencer` validates and enqueues casting.
- [x] **Product image requirement:** `POST /api/projects/[id]/select-influencer` returns 400 if `product_image_url` is empty. Analysis review page already gates the approve button without a product image.
- [x] **Product interaction prompt:** Per-segment product placement controls shown at `influencer_selection` gate. User can override visibility (none/subtle/hero/set_down) and add custom notes per segment. Stored as `product_placement` JSONB on project. CastingAgent merges user overrides into keyframe prompts.

**Pipeline hardening:**
- [x] Enable full 4-segment processing — all agents already use `SEGMENTS = [0, 1, 2, 3]`
- [x] Harden CastingAgent: per-segment try/catch with 1 retry + 5s delay, failed segments create `status: 'failed'` asset records, stage only throws if ALL segments fail
- [x] Harden DirectorAgent: per-segment retry (2 retries + 10s delay), missing startKeyframe creates failed asset + continues, endKeyframe optional
- [x] Harden VoiceoverAgent: per-segment try/catch, failed segments create `status: 'failed'` asset records, audio size validation warns on truncated/oversized output, voice caching on character records already implemented
- [x] Asset review UI: per-segment image/video/audio preview with approve/reject/regenerate per-asset. Keyframes shown side-by-side, stats bar, auto-polling during generation, per-asset reject/regenerate buttons with BullMQ worker handler.
- [x] Cost confirmation dialog before expensive operations (casting: ~$0.56, directing: ~$4.80) — casting_review shows cost dialog before generating videos
- [x] Cost tracking: progress API returns `costUsd`, StageProgress displays running cost during all processing stages
- [x] Worker crash recovery: existing B0.10 retry/rollback endpoints + timeout warning in StageProgress triggers user action
- [x] Pipeline timeout detection: StageProgress shows amber warning when stage exceeds expected duration (casting 5min, directing 20min, voiceover 5min, editing 10min)

#### R1.2 - Video Composition (Phase 4 - EditorAgent)
**Priority:** P0 - Critical
**Effort:** Large
**Status:** Complete (2026-02-15)
**Why:** The final deliverable — composing raw assets into a finished video.

- [x] EditorAgent: Compose 4 video segments + voiceover audio + text overlays into 60s video — fetches completed video/audio assets, maps to Creatomate template slots (Video-1..4, Audio-1..4, Text-1..4), polls render, creates `final_video` asset
- [x] Integration with Creatomate — CreatomateClient with `renderVideo()`, `getRenderStatus()`, `pollRender()`, structured logging
- [x] Text overlay rendering (hook text, CTA text from script) — EditorAgent passes `Text-N` modifications from `scene.text_overlay` to Creatomate template
- [x] Transition effects between segments — handled by Creatomate template (`85021700-850c-49cf-a65f-06aa50e720e6`)
- [x] Handle `editing` status in ProjectDetail UI — StageProgress shows "Composing Final Video" spinner, progress bar, elapsed timer
- [x] Final review page: video player, download button, share link — HTML5 video player (9:16), download button, copy link button, recipe summary
- [x] Render status tracking and progress indicator — progress API polls final_video asset completion, StageProgress shows generating/completed/failed counts
- [x] **Run archive:** `POST /api/projects/[id]/archive` snapshots full recipe into `completed_run` table. Archive button in completed UI.

#### ~~R1.3 - Reference Video Intelligence~~ DONE
**Priority:** P0 - Critical
**Effort:** Medium
**Status:** Complete (2026-02-15)
**Why:** Core differentiator — "drawing influence from existing TikTok videos" is the stated customer need.

- [x] Video analysis agent: Download and analyze reference TikTok videos — VideoAnalysisAgent uses yt-dlp + Google Gemini 2.5 Flash with SEAL method (Scene, Emotion, Angle, Lighting)
- [x] Extract pacing, hook style, energy arc, visual composition from reference — SEAL framework: per-segment scene/emotion/angle/lighting breakdown stored as `video_analysis` JSONB
- [x] Feed reference analysis into ScriptingAgent (match proven viral patterns) — SEAL data in prompt with strong influence instruction, reference structure dominates
- [x] Feed reference analysis into DirectorAgent (match camera work, transitions) — SEAL data enriches CastingAgent keyframe prompts for visual style matching
- [x] UI: Show reference video alongside generated output for comparison — Analysis review page shows SEAL cards + video player; completed page has side-by-side reference vs generated comparison

#### ~~R1.4 - Pipeline Observability & Logging~~ DONE
**Status:** Complete (2026-02-15)
**Implemented:** Pino structured logging (`src/lib/logger.ts`), `generation_log` table with correlation IDs, API call audit trail with timing/cost, all `console.log/error` replaced across agents/workers/API routes/API clients. Debugger agent skill created for read-only investigation.

#### ~~R1.5 - Product Versioning~~ DONE
**Status:** Complete (2026-02-15)
**Implemented:** `src/lib/version.ts` (single source of truth), `GET /api/version` endpoint, version display in nav bar, version in worker startup log, build-time injection via `next.config.ts`, `package.json` bumped to v0.2.0, git tag `v0.2.0` created.

#### ~~R1.6 - Products as First-Class Entity~~ DONE
**Status:** Complete (2026-02-15)
**Depends on:** None (can run in parallel with R1.1 — different pipeline stages)
**Spec:** `docs/plans/2026-02-15-r1.6-products-entity-spec.md`
**Why:** Product data is denormalized into the `project` table. Every project re-runs ProductAnalyzerAgent from scratch — even for the same product URL. This wastes API costs ($0.01/analysis), wastes user time (re-approve same analysis), and prevents cross-project product insights. Products should be a first-class entity: analyze once, use across many projects.

**Data model:**
- [x] New `product` table (url, name, brand, category, selling_points, image_url, analysis_data, overrides, status, etc.)
- [x] Add `product_id` FK to `project` table
- [x] `overrides` JSONB column tracks which fields user has manually edited
- [x] Backward compat: old projects without `product_id` continue reading from their own `product_*` columns

**API:**
- [x] Full CRUD: `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/[id]`
- [x] PATCH accepts all analysis fields as overrides: selling_points, key_claims, benefits, usage, hook_angle, avatar_description, image_description, name, brand, category, etc.
- [x] PATCH tracks overridden fields in `overrides` column; reset-to-original per field
- [x] Product image upload/replace: `POST /api/products/[id]/image`
- [x] Re-analyze endpoint: `POST /api/products/[id]/reanalyze` — preserves user-overridden fields
- [x] Duplicate URL detection: if URL already analyzed, return existing product (no re-analysis)
- [x] `POST /api/projects` accepts `productId` — skips analysis for analyzed products
- [x] Delete guard: 409 if product referenced by projects

**Pipeline:**
- [x] ProductAnalyzerAgent writes to `product` table (not `project`)
- [x] Worker updates both `product` and `project` after analysis
- [x] Project creation with existing product: copy denormalized fields, skip analysis

**Frontend:**
- [x] Products tab in navigation (between Dashboard and Influencers)
- [x] Products list page (`/products`): cards with image, name, brand, category badge, status badge with pulse, project count, delete with guard
- [x] Product detail page (`/products/[id]`): analysis results, image upload/replace, re-analyze button, delete with confirmation, analyzing spinner, failed state with retry
- [x] Inline editing for all analysis fields: text fields click-to-edit with Enter/Escape, arrays with add/remove, category dropdown
- [x] "Edited" badge on overridden fields, "Reset to original" per-field action via OverrideBadge component
- [x] Create project form: product selector dropdown (shows analyzed products, skips analysis) + new URL input (hidden when product selected)

#### ~~R1.7 - B-Roll Agent~~ DONE
**Priority:** P0 - Critical
**Effort:** Medium-Large
**Status:** ~~DONE~~ (2026-02-15). All phases complete: planning, generation, storyboard UI, EditorAgent compositing with Ken Burns.
**Depends on:** R1.1 (pipeline must handle casting/directing/voiceover before B-roll generation phase runs)
**Spec:** `docs/plans/2026-02-15-r1.7-broll-agent-design.md`
**Why:** High-performing TikTok Shop content uses B-roll inserts (cutaway images) to maintain viewer attention and validate claims. Without B-roll, videos are a single visual layer — flat and monotonous. B-roll is a visual argument that reinforces the script's persuasion structure. The agent operates in two phases: planning (at script review) and generation (after directing).

**ScriptingAgent integration:**
- [x] Add `broll_cues` field to scene table — timestamps, duration, intent, spoken text for each B-roll insert
- [x] ScriptingAgent generates cues alongside shot_scripts and audio_sync
- [x] Cues timed for ~2-3 second visual refresh intervals (short-form virality best practice)

**B-Roll planning (Phase 1 — after script approval, before influencer selection):**
- [x] B-RollAgent.plan() reads approved script + broll_cues + product category
- [x] Selects `BROLL_PRESETS` for product category (10 category-aware presets: transformation, research, lifestyle, social_proof, unboxing, comparison, etc.)
- [x] Shot count per segment: `ceil(syllable_count / 20)`, min 2, max 6
- [x] LLM generates categorized prompts with narrative roles for each shot
- [x] New `broll_shot` table stores planned shots (prompt, category, timing, duration, status)
- [x] New pipeline statuses: `broll_planning`, `broll_review`

**B-Roll API endpoints (backend):**
- [x] `GET/POST /api/projects/[id]/broll` — list + add shots
- [x] `PATCH/DELETE /api/projects/[id]/broll/[shotId]` — edit + remove shot
- [x] `POST /api/projects/[id]/broll/approve` — approve shot list → influencer_selection
- [x] `POST /api/projects/[id]/broll/[shotId]/upload` — upload user image to replace AI shot

**Storyboard view (user reviews B-roll plan):**
- [x] Vertical 60-second timeline showing script text + B-roll cards per shot_script
- [x] Edit prompt, change category, adjust timing/duration, remove, add, reorder
- [x] Upload own image to replace any AI-generated shot
- [x] Summary bar: total count, estimated cost, per-category breakdown
- [x] Approve → proceeds to influencer_selection

**B-Roll generation (Phase 2 — after directing + voiceover):**
- [x] B-RollAgent.generate() creates still images via Nano Banana Pro ($0.07/image)
- [x] Skips user-uploaded shots (already have image_url)
- [x] New pipeline status: `broll_generation`
- [x] Assets stored as type `broll` with timing metadata for EditorAgent

**EditorAgent integration:**
- [x] EditorAgent reads broll_cues (timestamps) + broll_shot records (images)
- [x] Composites B-roll as cutaway overlays at exact offset_seconds with duration_seconds
- [x] Applies Ken Burns effect (zoom/pan) for motion on still images — EditorAgent builds Creatomate keyframe animations (x_scale, y_scale, x, y) from KEN_BURNS_PRESETS, cycling zoom_in/zoom_out/pan_left/pan_right per shot

**Cost:** ~$0.85-1.13 per video (planning LLM: $0.01 + 12-16 images: $0.84-1.12). Total per video: ~$6.43-6.71.

---

### Tier 1.5: UX Hardening (Polish before scaling)

Ship-blocking bugs are fixed (Tier 0) and the pipeline works end-to-end (Tier 1). Before optimizing for conversions (Tier 2), harden the UX so the tool is pleasant to use repeatedly.

#### ~~R1.5.1 - Influencer Management Completion~~ DONE
**Status:** Complete (2026-02-15)
**Depends on:** B0.11 (image replacement must be fixed first)
**Why:** Influencers are a core entity. Basic CRUD gaps remain after partial B0.4 fix. B0.11 covers image replacement; this item covers the remaining UX polish.

- [x] PATCH endpoint for influencers (edit name, persona) — done in B0.4
- [x] Image re-upload / replacement — moved to B0.11 (Tier 0, higher priority)
- [x] Edit mode toggle on influencer detail page (inline editing for name, persona, with save/cancel) — edit/save/cancel buttons in header, name as input, persona as textarea
- [x] Prevent deletion of influencers assigned to active projects (or show warning with project list) — DELETE returns 409 with project list for active (non-completed/failed) projects only; frontend displays magenta error banner with linked project list

#### ~~R1.5.2 - Project Settings Editing~~ DONE
**Status:** Complete (2026-02-15)
**Priority:** P1 - Medium
**Effort:** Small
**Why:** Users can't change tone, character, or influencer after project creation. Must delete and recreate.

- [x] Editable project settings on detail page (tone, character, influencer) — PATCH whitelists `EDITABLE_PROJECT_FIELDS`, gated behind `REVIEW_GATE_STATUSES`; validates tone against `TONE_IDS`
- [x] "Restart pipeline" option: `POST /api/projects/[id]/retry` with `{ stage }` body restarts from review gate using `RESTART_STAGE_MAP`; also supports legacy failed retry via `failed_at_status`
- [x] Frontend settings panel on project detail page — compact read-only view (tone/character/influencer badges) with "Edit" button at review gates; expands to inline editing with ToneSelector, character/influencer dropdowns, name input; saves via PATCH with success/error feedback

#### ~~R1.5.3 - Navigation & State Consistency~~ DONE
**Status:** Complete (2026-02-15)
**Why:** Several small UX gaps that create friction across pages.

- [x] Back links on creation pages (`/projects/new`, `/influencers/new`) — arrow + text links to parent page
- [x] Link from project detail to assigned influencer (clickable, not just text) — thumbnail + name link in project header
- [x] Pagination or virtual scroll on project/influencer lists (breaks at 50+ items) — client-side 12-per-page pagination on project list
- [x] Search/filter on project list (by status, category, name) — search input + status filter pills (All/Active/Review/Completed/Failed) with count badge
- [x] Consistent empty states across all list views — all three lists (project/product/influencer) use same pattern: glow, icon, heading, description, CTA

#### ~~R1.5.4 - Error Handling & Recovery~~ DONE
**Status:** Complete (2026-02-15)
**Why:** Backend error infrastructure is solid (structured logging, status tracking, retry endpoints). Frontend needs to surface these errors to users instead of showing blank states.

**Backend (done):**
- [x] Status transition validation: `VALID_STATUS_TRANSITIONS`, `REVIEW_GATE_STATUSES`, `EDITABLE_PROJECT_FIELDS`, `RESTART_STAGE_MAP` constants in `src/lib/constants.ts`
- [x] Pipeline failure tracking: `failed_at_status` + `error_message` columns, all 6 worker handlers record failure state
- [x] Recovery endpoints: `POST /api/projects/[id]/retry` (failed retry + stage restart), `POST /api/projects/[id]/rollback`
- [x] Structured logging: Pino logger across all API routes, agents, worker, API clients

**Frontend (done):**
- [x] Error boundary component with retry button for failed data fetches — `src/components/error-boundary.tsx`, reusable React error boundary
- [x] Error state display in ScriptReview, AssetReview — magenta error panel with retry button replaces blank states on fetch failure
- [x] Network failure recovery: exponential backoff on polling (3s → 30s cap), connection warning after 5 failures in StageProgress and ProjectDetail
- [x] Failed pipeline recovery: surface `error_message` on project card (truncated single line in magenta)

#### ~~R1.5.5 - Engineering Roadmap Kanban Dashboard~~ DONE
**Priority:** P1 - Medium
**Effort:** Medium
**Spec:** `docs/plans/2026-02-15-r1.5.5-kanban-dashboard-design.md`
**Why:** The engineering roadmap lives in `ENGINEERING_ROADMAP.md` — a long markdown file that's hard to scan for current status. A `/roadmap` page parses the markdown at render time into a live Kanban board (Backlog / In Progress / Done) with FF7 character workers assigned by domain. The markdown remains the single source of truth.

**Backend:**
- [x] Markdown parser: extracts task ID, title, status, tier, priority, effort, dependencies, spec path, checkboxes, description, cost impact from ENGINEERING_ROADMAP.md
- [x] `GET /api/roadmap` returns parsed tasks + summary statistics + last git commit info
- [x] `GET /api/roadmap/workers` returns FF7 worker list with task counts
- [x] `PATCH /api/roadmap/assign` stores/updates worker override in `roadmap_worker` table
- [x] `roadmap_worker` table created via Supabase migration
- [x] Auto-assignment heuristic: domain keywords → FF7 character mapping (Cloud=Backend, Tifa=Frontend, Barret=Infra, Aerith=PM, Red XIII=QA)

**Frontend:**
- [x] `/roadmap` page with Kanban board (3 columns: Backlog, In Progress, Done)
- [x] Worker bar with FF7 character avatars and active task counts (filter by clicking)
- [x] Task cards with worker avatar, tier badge, progress bar (from checkboxes), dependencies, cost
- [x] Card click expands to full detail view (all checkboxes, spec link, description)
- [x] Worker reassignment dropdown on cards
- [x] Filter by tier (dropdown), search by task ID/title
- [x] Auto-poll every 30 seconds for live updates
- [x] "Roadmap" tab in navigation
- [x] Smooth animations: card column transitions, progress bar updates, worker avatar pulse

#### ~~R1.5.6 - FF7 Visual Theme~~ ~~DONE~~
**Priority:** P1 - High
**Effort:** Medium
**Spec:** `docs/plans/2026-02-15-ff7-visual-theme-design.md`
**Why:** The app has a solid dark cinematic aesthetic but no distinctive identity. The pipeline becomes an Active Time Battle system where AI agents are FF7 party members battling the "Blank Video" boss. Purely visual — no workflow, routing, API, or data changes. Sprites use CSS pixel art placeholders (swap to real PNGs later).

**Asset generation:**
- [ ] Generate ~30 pixel sprite assets via Nano Banana Pro (~$2.10 one-time) — deferred, using CSS placeholders

**Theme system:**
- [x] `ff7-theme.ts` constants: character-agent map, status-effect labels, battle text, Gil formatter
- [x] Mako-shifted color palette in globals.css (electric→Mako green, magenta→Ifrit red, lime→Cure green, amber→Chocobo gold)
- [x] Battle animations: atb-fill, attack-flash, ko-spin, victory-fanfare, command-cursor, enemy-hp-drain

**New components:**
- [x] `atb-bar.tsx` — ATB gauge per pipeline stage (replaces dot-line progress)
- [x] `battle-hud.tsx` — Battle HUD overlay on project detail (party lineup, enemy HP, Gil/MP counters)
- [x] `ff7-sprite.tsx` — Reusable character sprite (idle/attack/ko state, sizing) — CSS placeholders
- [x] `command-menu.tsx` — FF7-style vertical command menu for review gate actions
- [x] `gil-display.tsx` — Cost display with Gil coin icon

**Modified components:**
- [x] `nav.tsx` — Buster Sword logo, Materia nav dots, command-style New Project button
- [x] `status-badge.tsx` — FF7 status-effect names + icons (Scan, Haste, Wait, Summon, Fury, Victory, KO)
- [x] `pipeline-progress.tsx` — Major rewrite: ATB bar system with character colors
- [x] `project-card.tsx` — Active character sprite, Gil cost, expanded status accents
- [x] `project-detail.tsx` — Battle HUD wrapper, command menu at review gates, VICTORY/KO states
- [x] Empty states: "No encounters" / "No items in inventory" / "Party not assembled"
- [x] `approve-controls.tsx` — Materia orb grade buttons, CommandMenu for approve/regenerate

#### ~~R1.5.7 - Direct-to-Storage Image Uploads~~ DONE
**Priority:** P2 - Medium (backlog)
**Effort:** Small
**Why:** Influencer reference photos are currently routed through the Next.js API, which is constrained by Vercel's 4.5 MB body limit. Images are compressed client-side to fit, but the pipeline needs full-resolution photos for high-quality keyframe generation via CastingAgent. Uploading directly to Supabase Storage from the frontend bypasses the API route size limit entirely.

- [x] `POST /api/storage/upload-url` — generates signed upload URLs (2-hour expiry, upsert enabled)
- [x] `src/lib/storage.ts` — shared helpers: `generateUploadPath()`, `createSignedUploadUrl()`, `getPublicUrl()`, `deleteStorageFile()`, `extractStoragePath()`
- [x] API routes accept `storagePath` (JSON body) as alternative to FormData file blob: influencers POST/PATCH, product image, project product-image
- [x] Legacy FormData upload path preserved for backward compatibility
- [x] Frontend uses signed upload URL flow (frontend agent task — remove client-side compression)

#### ~~R1.5.8 - Navigable Pipeline Stages~~ DONE
**Priority:** P1 - Medium
**Effort:** Medium
**Status:** Complete (2026-02-15)
**Spec:** `docs/plans/2026-02-15-navigable-pipeline-stages-design.md`
**Why:** Users can't review or edit past stages without restarting the pipeline. Clicking completed stages lets them navigate back, view previous work, and make minor edits with downstream impact warnings.

**Backend:**
- [x] `DOWNSTREAM_IMPACT_MAP` constant — classifies edits as safe/destructive per stage
- [x] `PIPELINE_STAGE_ORDER` + `STAGE_COST_ESTIMATES` — cost estimation for impact warnings
- [x] `POST /api/projects/[id]/impact` — returns downstream impact, restart point, cost estimate
- [x] Fix retry endpoint to support broll_planning/broll_generation stages

**Frontend:**
- [x] Clickable completed stage nodes in pipeline progress bar
- [x] `viewingStage` + `editMode` state in project-detail.tsx
- [x] Navigation banner: "Viewing [Stage] — Current: [Stage]" with Back/Edit buttons
- [x] `readOnly` prop on ScriptReview, AssetReview, StoryboardView, InfluencerSelection
- [x] Destructive edit confirmation dialog with cost estimate from impact API

#### ~~R1.5.9 - Scene & Interaction Presets for Casting~~ DONE
**Priority:** P1 - High
**Effort:** Medium
**Spec:** `docs/plans/2026-02-15-scene-interaction-presets-design.md`
**Why:** CastingAgent currently gets scene descriptions from disconnected sources (character seed data, AVATAR_MAPPING, SEAL video analysis) with no user control. If the setting drifts between segments, keyframes look like they were shot in different rooms. Scene presets lock ONE visual environment across all 4 segments. Interaction presets describe HOW the creator physically engages with the product (stir, apply, try on) — critical for authentic UGC that converts.

**Backend:**
- [x] `scene_preset` table with 7 viral-optimized system presets (Bedroom Ring Light, Bathroom Vanity, Kitchen Counter, Car Confessional, Gym Mirror, Outdoor Walk, Cozy Desk)
- [x] `interaction_preset` table with 10 system presets (Hold & Show, Stir/Mix, Apply to Skin, Try On, Unbox, Demonstrate, Before/After, Pour/Drink, Compare, Set Down & Point)
- [x] `project` table: add `scene_preset_id`, `scene_override`, `interaction_preset_id`, `interaction_override` columns
- [x] CRUD APIs for scene + interaction presets (GET/POST/DELETE, system presets immutable)
- [x] `POST /api/projects/[id]/select-influencer` accepts scene + interaction selections
- [x] CastingAgent: replace `Setting: ${setting}` with scene + interaction descriptions + consistency rule
- [x] CastingAgent: "All 4 segments MUST use same room, lighting, props — only vary pose, energy, product visibility"
- [x] Legacy fallback: old projects without presets use `ai_character.setting`

**Frontend:**
- [x] Scene Selector component: card grid sorted by product category affinity, "★ Best match" badge, full description + virality notes on select, "+ Custom" form
- [x] Interaction Selector component: same card grid pattern with category sorting
- [x] Influencer selection page: WHO → WHERE → HOW three-section layout
- [x] Defaults pre-selected (Bedroom Ring Light + Hold & Show)
- [x] Custom presets saved to DB for reuse across projects

#### ~~R1.5.10 - Visual Script Breakdown~~ ~~DONE~~
**Priority:** P2 - Medium (backlog)
**Effort:** Medium
**Why:** The ScriptingAgent already outputs structured data per segment (shot_scripts, audio_sync, text_overlay, broll_cues), but the user sees these as scattered metadata — never as a unified "breakdown." A visual breakdown view at script review would show the full 60-second plan at a glance: script text with highlighted product mentions, tagged elements (props, wardrobe, interaction type, scene setting), B-roll cue markers on a timeline, camera/shot specs, and energy arc visualization. Inspired by Studiovity's auto-tagging script breakdown. Lets creators see their whole video plan before committing to expensive generation steps.

- [x] Auto-tag script segments with: props needed, interaction type (requires backend tagging)
- [x] Visual breakdown view at script review: full 60-second timeline with energy arc overlay, B-roll markers, product visibility, text overlays, shot scripts, audio sync peaks
- [x] Highlighted product mentions in script text (clickable to see product placement details for that segment)
- [x] Camera/shot specs surfaced as editable fields: angle (close-up/medium/wide), movement (static/pan/zoom), lighting direction
- [x] Beat board view option: 4-segment visual arc (Hook → Problem → Solution → CTA) with energy levels, B-roll placements, scene previews
- [x] Cards / Timeline / Beats toggle in script-review.tsx
- [x] `broll_cues` typed in Scene interface across components

#### ~~R1.5.11 - Keyframe Consistency Validation~~ SUPERSEDED
**Priority:** P2 - Medium (backlog)
**Effort:** Small
**Depends on:** R1.5.9 (scene presets provide the consistency baseline)
**Status:** Superseded (2026-02-15) — Replaced by chained keyframe generation. Instead of detecting drift post-generation, the CastingAgent now prevents drift by chaining each segment's end frame as a reference image for the next segment. Sequential processing with continuity prompts ensures visual consistency across all 4 segments.
**Spec:** `docs/plans/2026-02-15-chained-keyframes-design.md`

- [x] ~~Post-generation consistency scoring~~ → Replaced by chained generation (end frame → next segment reference)
- [x] ~~Drift detection~~ → Prevented by continuity prompt + reference image chaining
- [x] ~~Auto-regenerate drifted segments~~ → Not needed; segments inherit visual context from previous end frame

#### ~~R1.5.12 - Projects Quest Board (FF7 World Map Kanban)~~ ~~DONE~~
**Priority:** P1 - High
**Effort:** Medium
**Status:** Complete (2026-02-16) — Replaced flat project grid with FF7 World Map Kanban. 6 location columns (Midgar → Kalm → Cosmo Canyon → Junon → Gold Saucer → Northern Crater). Cards in 4 visual states (processing/review/victory/KO). Stats bar with filter toggles. Failed projects placed via `failed_at_status`. Search + stat filter with AND logic. Pixel art location icons deferred to v2.
**Spec:** `docs/plans/2026-02-15-projects-quest-board-design.md`
**Depends on:** R1.5.6 (FF7 Visual Theme provides character sprites, Mako palette, battle animations)

**New components:**
- [x] `quest-board.tsx` — Main board layout with 6 world-map columns + quest path
- [x] `quest-card.tsx` — Rich interactive card (4 states: processing, review gate, victory, KO) with ATB bar, character sprite, quick actions
- [x] `quest-column.tsx` — Single location column with header icon, project count, scrollable cards
- [x] `quest-path.tsx` — Dot-line path between columns with Mako glow
- [x] `quest-stats.tsx` — Stats bar: In Battle / Awaiting Orders / Victories / KO / Gil total

**Modified components:**
- [x] `page.tsx` (dashboard) — Swap ProjectList → QuestBoard, widen to `max-w-[1600px]`
- [x] `globals.css` — Add `animate-awaiting-pulse` keyframe

#### ~~R1.5.13 - Auto-Upscale Influencer Images to 4K~~ ~~DONE~~
**Priority:** P1 - High
**Effort:** Small
**Status:** Complete (2026-02-15) — Simplified from original spec. Upscale runs inline at upload time (matching product image pattern), no separate columns or async worker needed. 4K URL stored directly in `image_url`.
**Spec:** `docs/plans/2026-02-15-chained-keyframes-design.md` (Part 1)
**Depends on:** ~~B0.14~~ (image filtering bug — already fixed)

**Schema:**
- [x] ~~`image_url_4k`, `upscale_status`, `upscale_task_id` columns~~ → Simplified: added `cost_usd` column only. 4K URL stored directly in `image_url`.

**Backend:**
- [x] `GET /api/influencers?hasImage=true` filter (fixed in B0.14)
- [x] POST influencer: inline 4K upscale via `WaveSpeedClient.upscaleImage()` after image upload, non-fatal fallback
- [x] PATCH influencer: same inline 4K upscale on image change, cumulative cost tracking
- [x] ~~CastingAgent: use `image_url_4k ?? image_url`~~ → Not needed; `image_url` is already 4K after upload

**Frontend:**
- [x] WHO selection grid: fetches with `hasImage=true` (done in B0.14)
- [x] Influencer detail: "4K" badge when `cost_usd > 0` (inline upscale, no async status needed)
- [x] Influencer detail: "Has Image" field shows "Yes (4K)" when upscaled

**Cost:** $0.01 per upload. ~$0.20 for 20 influencers.

#### ~~R1.5.14 - Editable Analysis Review~~ DONE
**Priority:** P1 - High
**Effort:** Small
**Status:** Complete (2026-02-15)
**Why:** The analysis review stage showed product data (selling points, key claims, benefits, usage, hook angle, avatar description) as read-only cards. Users couldn't correct AI mistakes or tailor the analysis before proceeding to script generation. The Product detail page (`/products/[id]`) already had inline editing, but the project-level analysis review did not.

- [x] Added `product_data` to `ALWAYS_ALLOWED` fields in `PATCH /api/projects/[id]`
- [x] `AnalysisResults` component: new `editable`, `projectId`, `onDataUpdated` props
- [x] "Edit Analysis" toggle button at analysis review (hidden in read-only/past stage views)
- [x] Array fields (Selling Points, Key Claims, Benefits): inline edit, add, remove items with auto-save on blur
- [x] Text fields (Usage, Hook Angle, Avatar Description): textarea editing with auto-save on blur
- [x] Saving indicator per field
- [x] Per-field regeneration via LLM — `POST /api/projects/[id]/regenerate-field` accepts `{ field, feedback? }`, regenerates one field via WaveSpeed LLM, updates `product_data`. Frontend: regenerate button (refresh icon) + optional feedback input wired to all array and text fields in AnalysisResults.

#### R1.5.15 - Project Sequential Numbering ~~DONE~~
**Priority:** P1 - Medium
**Effort:** Small
**Status:** Complete (2026-02-15). Backend schema + backfill done. Frontend display live.
**Why:** Projects only have UUIDs — no human-readable identifier. A sequential number gives each project a short, memorable reference (PROJECT-1, PROJECT-2, ...) visible across all UI surfaces. Useful for conversation ("check PROJECT-14"), search, and future batch/campaign grouping.

**Schema:**
- [x] Add `project_number` column to `project` table — PostgreSQL sequence (`project_number_seq`), unique, not null, auto-incrementing
- [x] Backfill existing projects by `created_at` order (PROJECT-1 = oldest, 4 projects backfilled)

**Backend:**
- [x] `POST /api/projects` — `project_number` auto-assigned by PostgreSQL on insert (no application logic needed)
- [x] `GET /api/projects` and `GET /api/projects/[id]` — return `project_number` in response (already returned via `select('*')`)

**Frontend:**
- [x] Project card (`project-card.tsx`) — display `PROJECT-N` at top of card, above product name
- [x] Project detail header (`project-detail.tsx`) — display `PROJECT-N` prominently in header
- [x] Project list search — allow searching by project number (e.g., "14" or "PROJECT-14")

#### R1.5.16 - Video Model Selection & Pipeline Abstraction
**Priority:** P0 - Critical
**Effort:** Large
**Status:** Backend abstraction complete (2026-02-15). Frontend selector + badge complete (2026-02-16). **Remaining:** B-RollAgent + EditorAgent still hardcode segments, WaveSpeed resolution param deferred.
**Spec:** `docs/plans/2026-02-15-video-model-selection-design.md`
**Why:** The pipeline hardcodes Kling 3.0 Pro assumptions (4 segments, 15s, 3 shots, Kling endpoint) across 7+ files. Making "video model" a first-class database entity decouples the pipeline from a single model. Each video model profile defines technical params (segments, duration, resolution, API endpoint) AND creative structure (energy arc, product placement arc, section names). All agents read config from the project's video model. Initial scope: Kling 3.0 Pro only (60s, 4x15s, 1080p), but the abstraction enables future models/formats.

**Schema:**
- [x] `video_model` table with slug, provider, endpoint, segment/duration/shot config, resolution, arcs, section names, cost
- [x] `project.video_model_id` FK, backfilled to Kling 3.0 Pro for existing projects
- [x] Kling 3.0 Pro seed row with all current `PIPELINE_CONFIG` / `ENERGY_ARC` / `PRODUCT_PLACEMENT_ARC` values

**Backend (6 agents + worker + API):**
- [x] Worker fetches video model with project, passes config to all agents
- [x] ScriptingAgent: validation uses video model (segment count, syllables, shots_per_segment, section names, arcs)
- [x] CastingAgent: dynamic segments/arcs from video model (energy arc, product placement arc, frame actions)
- [x] DirectorAgent: dynamic duration, slug, shot_duration, supports_tail_image, supports_multi_prompt, cost from video model
- [x] VoiceoverAgent: audio validation adapts to segment_duration, loop uses segment_count
- [ ] B-RollAgent: timing adapts to segment_duration (uses hardcoded segments, low priority — agent is light)
- [ ] EditorAgent: dynamic slot generation from segment_count (uses hardcoded 4, low priority — Creatomate template-driven)
- [x] `GET /api/video-models`, project routes accept/return video_model_id
- [ ] WaveSpeed client: add resolution param to generateVideo() (deferred — Kling uses 1080p default)
- [ ] `PIPELINE_CONFIG` kept as fallback for backward compatibility

**Frontend:** ~~DONE~~ (2026-02-16)
- [x] Create project form: video model selector (pre-selected Kling 3.0 Pro, shows duration/segments/resolution)
- [x] Project detail: video model badge in settings bar (amber-hot themed) + editable dropdown at review gates

---

#### R1.5.17 - Keyframe Prompt Visibility ~~DONE~~
**Priority:** P2 - Low
**Effort:** Small
**Status:** Complete (2026-02-15).
**Why:** During keyframe review, users have no visibility into the prompt that generated each keyframe. An info icon that reveals the generation prompt helps users understand why a keyframe looks the way it does, make better edit/regenerate decisions, and debug unexpected results.

**Backend:**
- [x] Include generation prompt in the asset response for keyframe assets — `GET /api/projects/[id]/assets` now joins `scene.visual_prompt` (a `{ start, end }` JSON object). Frontend matches `asset.type` (`keyframe_start`/`keyframe_end`) to the corresponding prompt string.

**Frontend:**
- [x] Add info icon to each keyframe card in the casting review stage (`asset-card.tsx`)
- [x] On click, show popover with the full prompt used for that keyframe's generation

#### R1.5.18 - Energy Arc Mini Graph in Script Review ~~DONE~~
**Priority:** P2 - Low
**Effort:** Small
**Status:** Complete (2026-02-16)
**Why:** The energy arc (e.g. `low → high → medium → high`) is a key creative parameter that shapes pacing, but it's currently shown as plain text. A small SVG line graph (sparkline) capturing start, mid, and end energy levels would make it instantly scannable and more intuitive during script review.

**Frontend:**
- [x] Create `energy-arc-graph.tsx` — inline SVG sparkline component, takes energy arc array, renders as a connected line graph with colored dots per energy level, segment dividers, gradient fill, and section labels
- [x] Integrate into `script-review.tsx` between full script text and view toggle

#### R1.5.19 - Structured Prompt Schema for Asset Generation ~~DONE~~
**Priority:** P0 - Critical
**Effort:** Medium
**Spec:** `docs/plans/2026-02-16-structured-prompt-schema-design.md`
**Depends on:** R1.5.16 (video model provides resolution + model-specific negative prompts)
**Why:** Asset generation prompts are inconsistent across agents — CastingAgent uses LLM free-text, DirectorAgent uses generic string concatenation, B-RollAgent uses single-string JSON. Negative prompts are 3 different hardcoded strings, none comprehensive. A unified `StructuredPrompt` JSON schema optimized for Kling 3.0 standardizes all prompts with fields for subject, product, dialogue, action sequence, camera specs, environment, lighting, style, and negative prompt. LLM outputs structured JSON, a shared serializer converts to API-ready strings per target.

**New files:**
- [x] `src/lib/prompt-schema.ts` — StructuredPrompt interface + KLING_NEGATIVE_PROMPT + IMAGE_NEGATIVE_PROMPT + resolveNegativePrompt() + isStructuredPrompt()
- [x] `src/lib/prompt-serializer.ts` — serializeForImage(), serializeForVideo(), serializeForBroll()

**Agent refactor:**
- [x] CastingAgent: LLM outputs `{start: StructuredPrompt, end: StructuredPrompt}` instead of `{start: string, end: string}`
- [x] DirectorAgent: add LLM step, replace string concatenation with structured prompt + serializer (+$0.04/video)
- [x] B-RollAgent: planning LLM outputs StructuredPrompt fields per shot, stored in metadata
- [x] Pipeline worker: regenerateKeyframe() + regenerateVideo() use structured JSON + serializer
- [x] Remove all scattered NEGATIVE_PROMPT strings, replace with centralized constants

**Negative prompt backend:**
- [x] `negative_prompt_override` JSONB column on `project` table (migration applied)
- [x] PATCH /api/projects/[id] accepts `negative_prompt_override` in always-allowed fields
- [x] Agents read project override before falling back to model default via resolveNegativePrompt()
- [x] Frontend UI: NegativePromptPanel at casting_review — collapsible panel with 3 stage tabs (casting/directing/broll), view/edit/reset per-stage overrides, auto-save via PATCH

**Backward compat:**
- [x] isStructuredPrompt() type guard detects old string format vs new StructuredPrompt in `scene.visual_prompt`
- [x] Existing projects continue working without migration — legacy strings pass through

#### ~~R1.5.20 - Influencer Voice Design System~~ DONE
**Priority:** P0 - Critical
**Effort:** Medium
**Spec:** `docs/plans/2026-02-16-influencer-voice-design-system.md`
**Depends on:** None (can start immediately)
**Why:** Voice is currently a pipeline side effect — derived from a broken `VOICE_MAPPING[product_category]` lookup that always falls back to "pharmacist." Every influencer sounds the same regardless of persona. Voice should be a first-class influencer attribute: designed via ElevenLabs Voice Design with user-approved presets, stored permanently, and reused across projects. Kling native audio is muted in the final render — only ElevenLabs TTS is heard. Fixes Gap 3 (voice mapping mismatch) from the pipeline analysis.

**Schema:**
- [x] `voice_preset` table (~8 system presets: Trusted Expert, Energetic Creator, Calm Reviewer, Big Sister, Hype Man, Wellness Guide, Street Smart, Trendsetter) + custom user presets
- [x] `influencer` table: add `voice_id`, `voice_preset_id` FK, `voice_description`, `voice_preview_url` columns

**Backend:**
- [x] `GET /api/voice-presets` — list all presets
- [x] `POST /api/voice-presets` — create custom preset
- [x] `DELETE /api/voice-presets/[id]` — delete custom preset (system presets immutable)
- [x] `POST /api/influencers/[id]/voice/design` — call ElevenLabs Voice Design, return preview audio + temporary voice ID
- [x] `POST /api/influencers/[id]/voice/approve` — save voice permanently to ElevenLabs + influencer record
- [x] `DELETE /api/influencers/[id]/voice` — clear voice (influencer becomes ineligible for selection)
- [x] `POST /api/projects/[id]/select-influencer` — hard gate: reject if `influencer.voice_id` is null
- [x] `GET /api/influencers?hasVoice=true` — filter by voice presence
- [x] VoiceoverAgent: remove `VOICE_MAPPING`, `FALLBACK_VOICES`, `resolveVoice()`, `isVoiceValid()`. Replace with direct `influencer.voice_id` read.
- [x] EditorAgent: mute Kling video audio (`volume: 0` on Video-1..4 Creatomate modifications)
- [x] Remove obsolete `CATEGORY_TO_PERSONA` from `src/lib/constants.ts`

**Frontend:**
- [x] ~~Influencer page: voice preset card grid (same pattern as scene/interaction presets), "+ Custom" option~~ DONE
- [x] ~~"Design Voice" button → preview audio player → approve/regenerate~~ DONE
- [x] ~~Voice badge on influencer cards + play preview button~~ DONE
- [x] ~~Influencer selection gate: filter `hasImage=true&hasVoice=true`, voice preview on selection cards~~ DONE

**Cost:** ~$0.01 per voice design (one-time per influencer). TTS cost unchanged ($0.20/video).

#### R1.5.24 - ElevenLabs Voice ID Reference (Replace Voice Design API) ~~DONE~~
**Priority:** P0 - Critical
**Effort:** Small
**Depends on:** R1.5.20 ✅ (replaces its Voice Design API integration)
**Why:** The ElevenLabs Voice Design API is failing in production ("Voice design failed. Please try again."). Rather than debugging a complex 3-step flow (preset → design → approve) that rebuilds what ElevenLabs already provides, simplify to: user designs voice in ElevenLabs' own dashboard (better iteration, previewing, fine-tuning), then pastes the Voice ID into our app. Eliminates the `voice_preset` table, 3 voice API routes, and the 590-line VoiceSection component.

**Backend:** ~~DONE~~
- [x] `POST /api/influencers/[id]/voice/link` — accepts `{ voiceId: string }`, calls ElevenLabs `GET /v1/voices/{voiceId}` to validate + fetch metadata (name, description, preview_url, labels), saves `voice_id`, `voice_description`, `voice_preview_url` to influencer record
- [x] `DELETE /api/influencers/[id]/voice` — keep existing (clears voice fields, removed `voice_preset_id` reference)
- [x] Remove dead routes: `POST /api/influencers/[id]/voice/design`, `POST /api/influencers/[id]/voice/approve`
- [x] Remove dead routes: `GET /api/voice-presets`, `POST /api/voice-presets`, `DELETE /api/voice-presets/[id]`
- [x] Drop `voice_preset` table + remove `voice_preset_id` FK from `influencer` (migration applied)
- [x] Added `getVoice()` method to ElevenLabs client, removed `designVoice()` and `saveVoice()` dead methods
- [x] Updated `schema.ts` — removed `voicePreset` table and `voicePresetId` column from influencer
- [x] VoiceoverAgent: no changes needed (already reads `influencer.voice_id` directly)

**Frontend:** ~~DONE~~
- [x] Replace VoiceSection in `influencer-detail.tsx`: removed preset grid + Design Voice flow. New UI: Voice ID text input + "Link Voice" button. On success, shows voice name, description, Voice ID, and audio preview player
- [x] Influencer detail: linked state shows voice name, description text, Voice ID, and audio preview player (adapted from old State C)
- [x] Influencer list cards: keep existing voice badge + play preview (no changes needed)
- [x] Influencer selection gate: keep existing `hasVoice=true` filter (no changes needed)

**Cost:** $0 (no Voice Design API calls). TTS cost unchanged ($0.20/video).

#### R1.5.21 - Parallel Directing + Voiceover Pipeline
**Priority:** P1 - Medium
**Effort:** Small-Medium
**Depends on:** None
**Why:** Directing and voiceover currently run sequentially (`directing → voiceover → broll_generation`), but VoiceoverAgent only needs `scene.script_text` (produced by ScriptingAgent) — it does NOT depend on video assets from DirectorAgent. Running them in parallel saves ~3-5 minutes per video run (voiceover completes during directing's 15-20 min video generation wait).

**Backend:**
- [ ] Worker: after casting_review approval, enqueue both `directing` and `voiceover` jobs simultaneously
- [ ] Add completion tracking: `broll_generation` only enqueues when BOTH directing and voiceover are complete
- [ ] New project sub-statuses or flags: `directing_complete`, `voiceover_complete` (or use asset presence checks)
- [ ] Progress API: show both stages running simultaneously
- [ ] Error handling: if one fails, the other continues (don't cancel). User retries the failed one only.

**Frontend:**
- [ ] Pipeline progress: show directing and voiceover as parallel branches (split → merge at broll_generation)
- [ ] Progress polling handles both stages active simultaneously

#### R1.5.22 - B-Roll Timing Integration in EditorAgent
**Priority:** P2 - Medium
**Effort:** Medium
**Depends on:** Understanding Creatomate overlay timing API
**Why:** B-RollAgent calculates `broll_shot.timing_seconds` and `duration_seconds` per shot — exactly when in the 15s segment a cutaway should appear and for how long. EditorAgent ignores this metadata entirely. Ken Burns animations are driven by fixed Creatomate template slots, not by the timing data. B-roll appears at template-defined positions rather than at the script-cued moments (e.g., when the narrator says "look at these results" should cut to transformation B-roll).

**Backend:**
- [ ] EditorAgent: read `broll_shot.timing_seconds` and `duration_seconds` for each shot
- [ ] Pass timing as Creatomate keyframe `time` values so B-roll overlays match script cues
- [ ] Validate timing doesn't exceed segment duration

**Frontend:**
- [ ] No changes needed (storyboard already shows timing)

**Requires:** Creatomate template changes to support dynamic overlay timing (may need template redesign)

#### R1.5.23 - Smart Cascade Editing (Per-Segment Regeneration)
**Priority:** P0 - Critical
**Effort:** Large
**Spec:** `docs/plans/2026-02-16-smart-cascade-editing-design.md`
**Depends on:** R1.5.8 (navigable pipeline stages provides the edit-past-stages mechanism)
**Why:** After keyframes are generated, editing the script costs ~$6.20 to cascade through ALL 4 segments — even if only 1 segment changed (~$1.60). There's no auto-cascade (user must manually restart), no per-segment diff detection, and B-roll gets orphaned (planned for old script, not re-planned for edits). This makes script iteration prohibitively expensive and clumsy. Smart cascade detects which segments changed, shows per-segment cost impact, auto-enqueues only affected segments, and re-plans B-roll for changed segments only.

**Segment diff detection:**
- [ ] `src/lib/segment-diff.ts` — compare old vs new per-segment: script_text, shot_scripts, energy_arc, broll_cues
- [ ] Return `SegmentDiff[]` with changed fields, downstream asset counts, and per-segment cost estimate

**Cascade API:**
- [ ] `POST /api/projects/[id]/cascade` — accepts confirmed segment diffs, enqueues surgical regeneration
- [ ] `PATCH /api/projects/[id]` returns `segmentDiffs` in response when script edited with downstream assets present
- [ ] New `cascade_in_progress` pipeline status with per-segment tracking

**Agent surgical support (all agents accept `segmentIndices` parameter):**
- [ ] CastingAgent: process only affected segments, preserve keyframe chain from unchanged segments' end frames
- [ ] DirectorAgent: process only affected segments
- [ ] VoiceoverAgent: process only affected segments
- [ ] B-RollAgent: re-plan only for segments with changed script_text or broll_cues
- [ ] EditorAgent: re-composite full video after all affected segments complete
- [ ] Pipeline worker: cascade job handler passes segmentIndices to agents

**Frontend:**
- [ ] Cascade confirmation dialog: per-segment changes, downstream impact, cost estimate
- [ ] "Save & Regenerate Affected" vs "Save Only" buttons at script review in edit mode
- [ ] Per-segment progress indicators during cascade (which segments are regenerating)
- [ ] Old assets marked 'superseded' (not deleted) during cascade

**Cost savings:** Editing 1 of 4 segments: ~$1.60 instead of ~$6.20 (74% savings).

#### ~~R1.5.25 - Asset Download for All Generated Media~~ DONE
**Priority:** P0 - Critical
**Effort:** Small
**Status:** Complete (2026-02-16)
**Depends on:** None
**Why:** Users can only download the final composed video. Individual assets — keyframe images, per-segment video clips, voiceover audio, B-roll images — have no download option. Creators need these raw assets for repurposing.

**Frontend:**
- [x] Download icon button on each keyframe image in casting review (start + end per segment)
- [x] Download icon button on each video segment in directing review
- [x] Download icon button on each voiceover audio clip in voiceover review
- [x] Download icon button on each B-roll image in storyboard view
- [x] Download icon button on final composed video (rewired to fetch-and-blob with proper filename)
- [x] "Download All" button per stage with progress counter (3/8)
- [x] Descriptive filenames: `PROJECT-{N}_keyframe-seg{X}-start.png`, `PROJECT-{N}_video-seg{X}.mp4`, etc.
- [x] Shared download utilities: `src/lib/download-utils.ts` (downloadAsset, downloadViaProxy, filename builders)
- [x] Reusable components: `src/components/download-button.tsx` (DownloadButton + DownloadAllButton)
- [x] Error feedback: inline error toast on failed downloads (auto-dismiss after 4s)

**Backend:**
- [x] `GET /api/projects/[id]/assets/[assetId]/download` — server-side proxy for large files (streams with Content-Disposition: attachment, validates asset ownership, 100MB cap, 60s timeout)
- [x] Video assets routed through backend proxy (avoids 50-100MB blobs in browser memory)
- [x] Keyframes/audio use client-side fetch-and-blob (small files, no memory concern)

#### ~~R1.5.25b - B-Roll Product Image Reference in Generation~~ DONE
**Priority:** P1 - Medium
**Effort:** Small
**Depends on:** None
**Why:** B-roll shots that mention the product by name (e.g., "Collagen Bio-Peptides Powder on a kitchen counter") were generated via text-to-image, so the model invented a random product appearance instead of matching the actual product packaging. Now the BRollAgent detects product name mentions in the prompt and uses Nano Banana Pro edit mode with the product's best available image as a reference, so generated b-roll shows the actual product.

**Backend:** ~~DONE~~
- [x] `BRollAgent.generate()`: Fetch product name + best product image (primary, prefer `url_clean`) at start of generation
- [x] Per-shot product name detection (case-insensitive, supports 2-word partial matches)
- [x] Conditional path: `editImage([productImageUrl], prompt)` when product mentioned, `generateImage(prompt)` otherwise
- [x] Asset metadata includes `product_ref: true` flag for traceability
- [x] Provider set to `nano-banana-pro-edit` when using product ref (same $0.07 cost)

#### R1.5.26 - Scripting Validation Enforcement (Reject Invalid Scripts)
**Priority:** P1 - High
**Effort:** Small
**Depends on:** None
**Discovered:** 2026-02-16 (bug bash)
**Why:** ScriptingAgent validates syllable counts, segment count, and shot_scripts count — but only logs warnings. Invalid scripts pass through to downstream agents unchecked. A script with 3 segments instead of 4 reaches CastingAgent, which generates 3 keyframe sets; DirectorAgent generates 3 videos; VoiceoverAgent generates 3 audio clips. The final video has a 15-second gap. Similarly, scripts with extreme syllable counts produce audio that clips or has dead silence. Validation must reject and auto-regenerate, not just warn.

**Backend:**
- [ ] ScriptingAgent: if segment count !== `videoModel.segment_count`, retry LLM generation (up to 2 retries) with explicit "You MUST return exactly N segments" reinforcement
- [ ] ScriptingAgent: if any segment syllable count is outside acceptable range (±20% of target), retry with feedback on which segments are out of range
- [ ] ScriptingAgent: if `shot_scripts` count per segment !== `videoModel.shots_per_segment`, retry with reinforcement
- [ ] After 2 retries: fail the stage with a clear error listing which validations failed (don't silently pass bad scripts)
- [ ] Log each retry attempt to `generation_log` (event_type: `script_validation_retry`, detail: `{ attempt, violations }`)

#### R1.5.27 - LLM Call Retry in BaseAgent (Standardize Across All Agents)
**Priority:** P1 - High
**Effort:** Small
**Depends on:** None
**Discovered:** 2026-02-16 (bug bash)
**Why:** DirectorAgent and BRollAgent have retry logic for their primary operations, but ProductAnalyzerAgent and ScriptingAgent have zero retry on LLM calls. A single WaveSpeed LLM timeout or malformed response kills the stage immediately. LLM calls are inherently unreliable (rate limits, timeouts, malformed JSON responses). A standardized retry-with-backoff in BaseAgent would protect all agents automatically instead of each agent implementing its own retry.

**Backend:**
- [ ] Add `retryableLlmCall(fn, { maxRetries: 2, baseDelay: 5000 })` method to `BaseAgent` class
- [ ] Wraps any async function with exponential backoff retry (5s, 10s)
- [ ] Logs each retry to `generation_log` (event_type: `llm_retry`, detail: `{ agent, attempt, error }`)
- [ ] Distinguishes retryable errors (timeout, 429, 500, 503) from permanent errors (400, 401) — don't retry permanent failures
- [ ] Migrate ProductAnalyzerAgent and ScriptingAgent LLM calls to use `retryableLlmCall()`
- [ ] Migrate BRollAgent planning LLM call to use standardized retry (replace custom retry logic)

#### R1.5.28 - ElevenLabs Rate Limit Protection in VoiceoverAgent
**Priority:** P1 - Medium
**Effort:** Small
**Depends on:** None
**Discovered:** 2026-02-16 (bug bash)
**Why:** VoiceoverAgent fires 4 TTS calls in rapid succession with no delay between them. ElevenLabs enforces per-second and concurrent request rate limits. Under the free/starter tier, this can trigger 429 responses. The agent has per-segment try/catch but no backoff — a rate-limited segment is marked as failed immediately. Adding a small delay (500ms) between TTS calls and a retry-after-429 pattern would prevent most rate limit failures.

**Backend:**
- [ ] Add 500ms delay between TTS calls in VoiceoverAgent segment loop
- [ ] On 429 response: parse `Retry-After` header, wait that duration, retry once
- [ ] Log rate limit events to `generation_log` (event_type: `rate_limited`, detail: `{ provider: 'elevenlabs', retryAfterMs }`)
- [ ] Add retry on Supabase Storage upload failure (1 retry with 2s delay — currently no retry on upload)

#### R1.5.29 - Video Generation Preview & Test Mode ~~DONE~~
**Priority:** P0 - Critical
**Effort:** Medium
**Spec:** `docs/plans/2026-02-16-video-generation-preview-design.md`
**Depends on:** None (works with existing casting_review flow)
**Why:** Video generation is the most expensive pipeline stage ($4.80 for 4 segments). Currently the user approves blind at casting_review with no visibility into what prompts will be sent to Kling 3.0. Bad prompts waste $4.80 + require a full retry ($9.60 total). A per-segment preview panel shows the exact Kling payload before committing, lets users iteratively refine prompts via LLM feedback, and test-generate a single segment ($1.20) before approving the rest. Pre-tested segments are skipped by DirectorAgent, saving cost. A per-project Fast Mode toggle auto-advances through review gates for trusted/repeat products.

**Schema:**
- [x] Add `video_prompt_override` JSONB column to `scene` table
- [x] Add `fast_mode` boolean column to `project` table (default false)

**Backend:**
- [x] `POST /api/projects/[id]/segments/[segIdx]/preview` — build StructuredPrompt + serialize, return full payload preview (no Kling call, $0)
- [x] `POST /api/projects/[id]/segments/[segIdx]/refine` — re-run LLM with user feedback, save to `scene.video_prompt_override` ($0.01)
- [x] `POST /api/projects/[id]/segments/[segIdx]/test-generate` — generate single segment video via Kling ($1.20), create asset record, poll for completion
- [x] DirectorAgent: skip segments with existing completed video asset; use `video_prompt_override` when present
- [x] Pipeline worker: check `project.fast_mode` at review gates, auto-advance if enabled (never skip `influencer_selection` or `asset_review`)
- [x] Add `fast_mode` to `ALWAYS_ALLOWED` fields in PATCH `/api/projects/[id]`

**Frontend:**
- [x] Per-segment "Preview Video Prompt" expandable panel on casting review asset cards
- [x] Preview shows: keyframe thumbnails, main prompt, shot timeline (3 shots with energy badges), negative prompt (collapsible), config bar (duration, cfg_scale, cost)
- [x] "Adjust Prompt" feedback textarea → calls `/refine` → updates preview (iterative loop)
- [x] "Test Generate ($1.20)" button → generates single segment → inline video player on completion
- [x] "Approve Test" / "Regenerate" buttons after test video completes
- [x] "Approve & Continue" button shows dynamic cost (subtracts pre-tested segments)
- [x] Fast Mode toggle in project settings panel + amber badge on project card/header

#### R1.5.30 - Cancel In-Progress Generations ~~DONE~~
**Priority:** P0 - Critical
**Effort:** Medium
**Spec:** `docs/plans/2026-02-16-cancel-generations-design.md`
**Depends on:** R1.5.29
**Why:** Users had no way to stop a pipeline once started. Stuck or unwanted generations waste API credits ($4-7 per run) and block the UI. Cooperative cancellation via database flag lets users hard-cancel at any stage while preserving completed work.

**Schema:**
- [x] Add `cancel_requested_at` timestamp column to `project` table

**Backend:**
- [x] Enhanced `POST /api/projects/[id]/cancel` — sets cancel flag, flips in-flight/pending assets to cancelled, rolls back project status
- [x] `POST /api/projects/[id]/assets/[assetId]/cancel` — cancel individual asset generation
- [x] `CancellationError` custom error class (prevents BullMQ retries)
- [x] `shouldCancel` callback in `pollResult()` — checked each poll iteration
- [x] `BaseAgent.setCancelCheck()` — cooperative cancellation for CastingAgent, DirectorAgent, BRollAgent
- [x] Worker: CancellationError catch → clean exit, mark generating assets cancelled, clear flag
- [x] Worker: `isProjectCancelled()` checks before/after each stage handler

**Frontend:**
- [x] Cancel button on PipelineProgress during processing stages
- [x] Cancel confirmation dialog in ProjectDetail
- [x] Cancel button on individual generating assets (AssetCard)
- [x] Cancel test video generation (VideoPreviewPanel)
- [x] Cancelled status display on assets with regenerate option

#### R1.5.31 - Configurable Video Retries ~~DONE~~
**Priority:** P1 - High
**Effort:** Small
**Depends on:** R1.5.30
**Why:** DirectorAgent retried video generation 2x by default ($0.20/retry × 4 segments = $1.60 wasted on persistent failures). During initial testing, users want 0 retries to control costs. A per-project `video_retries` setting lets users dial in their risk tolerance.

**Schema:**
- [x] Add `video_retries` integer column to `project` table (default 0)

**Backend:**
- [x] DirectorAgent reads `video_retries` from project record, uses as `maxRetries` (replaces hardcoded `2`)
- [x] `video_retries` added to `ALWAYS_ALLOWED` fields in PATCH endpoint

**Frontend:**
- [x] Stepper control in project settings bar (0-3 range, +/- buttons)
- [x] Muted when 0, amber accent when > 0 (matches Fast Mode toggle style)

#### R1.5.32 - Asset Upload Replacement ~~DONE~~
**Priority:** P1 - High
**Effort:** Medium
**Spec:** `docs/plans/2026-02-17-asset-upload-replacement-design.md`
**Depends on:** None
**Why:** Users need to substitute their own images/videos for AI-generated assets. A keyframe that doesn't match the product, a video with wrong motion — instead of endless regeneration cycles, users upload their own file. Images auto-upscale to 4K for consistency with AI-generated keyframes.

**Backend:**
- [x] `POST /api/projects/[id]/assets/[assetId]/upload` — replaces asset with uploaded file
- [x] `POST /api/storage/asset-upload-url` — signed URL endpoint supporting image + video content types
- [x] Auto-upscale images to 4K via WaveSpeed ($0.01), skip for videos
- [x] Old storage file cleanup on replacement
- [x] Cost tracking for upscale operations

**Frontend:**
- [x] Upload button on AssetCard hover overlay for all visual asset types
- [x] Uploading spinner state on card during upload
- [x] Cascade propagation dialog after keyframe upload (same as edit flow)
- [x] "Upload Video" button on VideoPreviewPanel next to Test Generate
- [x] `uploadAssetToStorage()` utility in direct-upload.ts

#### ~~R1.5.33 - Lock Camera Setting for Video Generation~~ DONE
**Priority:** P1 - High
**Effort:** Small
**Depends on:** R1.5.29
**Why:** Some scenes look better with a completely static camera — especially close-up talking head shots where camera movement is distracting. A project-level toggle that locks the camera to static overrides all camera movement instructions in video prompts and adds camera motion terms to the negative prompt.

**Backend:**
- [x] `lock_camera` boolean column on `project` table (default false)
- [x] `serializeForVideo()` accepts `lockCamera` option — overrides camera_specs.movement to static, appends camera motion to negative prompt
- [x] DirectorAgent reads `lock_camera` from project, passes through all prompt paths (structured, legacy, override)
- [x] Test-generate route reads `lock_camera`, passes through all prompt paths

**Frontend:**
- [x] Toggle in Casting Review UI — `LockCameraToggle` component with `glass` panel, camera icon, descriptive label, PATCH toggle

---

#### ~~R1.5.34 - Product Size in Keyframe Prompts~~ DONE
**Priority:** P1 - High
**Effort:** Small
**Depends on:** R1.5.29
**Why:** Products appeared significantly smaller than their real-world size in generated keyframes because `product_size` data existed in the DB but was never passed to the CastingAgent's LLM prompt. The LLM had to guess proportions, resulting in undersized products.

**Backend:**
- [x] Add `scale?: string` field to `StructuredPrompt.product` interface and schema description
- [x] Extract `product_size`, `product_type`, `product_category` from project/product data in CastingAgent
- [x] Pass size/type info to `generateVisualPrompts()` and include in LLM user prompt
- [x] Add SCALE RULE instruction for realistic proportional rendering
- [x] Update fallback template prompt with size info

#### ~~R1.5.35 - Invalidate Stale Video Previews on Keyframe Regeneration~~ DONE
**Priority:** P1 - High
**Effort:** Small
**Depends on:** R1.5.23 (cascade editing provides per-segment regeneration)
**Why:** When a keyframe is regenerated (single or cascade), any previously generated video assets for the affected scene(s) remained marked as active. This caused stale video previews to display in the UI even though the underlying keyframe had changed. Automatically cancelling video assets in affected scenes ensures the UI never shows outdated previews.

**Backend:**
- [x] On keyframe regeneration (single or cascade), identify all video assets in affected scene(s)
- [x] Cancel/invalidate stale video assets so they are no longer shown as active
- [x] Ensure cancelled assets are excluded from downstream pipeline stages

---

### Tier 2: Make It Actually Convert (Quality & conversion optimization)

These features separate "generates a video" from "generates a video that sells."

#### R2.0b - Lip Sync Post-Processing
**Priority:** P1 - High (first quality item — visible artifact in every video)
**Effort:** Medium-Large
**Depends on:** R1.1 (end-to-end pipeline must be functional)
**Why:** Kling 3.0 generates video from keyframes with AI-generated lip movements that don't correspond to the ElevenLabs voiceover audio. The mouth moves but doesn't match the spoken words — a visible uncanny valley artifact in every talking-head shot. This is the single biggest quality gap between our output and real UGC. A lip sync post-processing step between voiceover and editing would take the generated video + TTS audio and correct the lip movements to match.

**Research needed:**
- [ ] Evaluate Wav2Lip, SadTalker, MuseTalk, Sync Labs, Hedra for quality, latency, and cost
- [ ] Determine hosting: self-hosted GPU (RunPod/Modal) vs. API service
- [ ] Benchmark: process a 15s segment — quality, latency, cost per segment
- [ ] Test edge cases: side angles, hand-over-mouth, product-in-frame shots

**Implementation:**
- [ ] New pipeline stage: `lip_sync` between `voiceover` and `editing` (or `broll_generation` and `editing`)
- [ ] LipSyncAgent: takes per-segment video URL + audio URL → outputs lip-synced video URL
- [ ] Pipeline worker: new handler for `lip_sync` stage with per-segment error handling
- [ ] Fallback: if lip sync fails for a segment, use original video (graceful degradation)
- [ ] Cost tracking: add lip sync cost to project total
- [ ] Progress UI: show lip sync stage in pipeline progress

**Cost estimate:** TBD after research (likely $0.02-0.10 per segment depending on provider)

#### R2.0 - Performance Tracking & KPI Dashboard ~~DONE~~ (backend)
**Priority:** P1 - High (first in Tier 2 - data foundation for everything below)
**Effort:** Medium
**Status:** Backend complete (2026-02-15). Frontend wired to live APIs (2026-02-15). RunTable still uses mock data (no `/api/analytics/runs` endpoint yet).
**Why:** Without closing the feedback loop, every optimization is guesswork. This connects generated videos to actual TikTok performance and revenue, turning the app from a production tool into a learning system. Also the data foundation that R2.1 (Hook Testing) and R2.2 (Trends) depend on.

**Database (3 tables via Supabase migrations):**
- [x] `tiktok_connection` — OAuth token storage (singleton constraint)
- [x] `video_performance` — Core metrics per completed video (ROI, badge, data_source)
- [x] `performance_snapshot` — Daily time-series snapshots (unique date constraint)

**TikTok API client (`src/lib/tiktok.ts`):**
- [x] `extractVideoId()`, `buildAuthUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()`
- [x] `fetchVideoMetrics()` (batch 20 IDs), `fetchUserInfo()`, `getValidAccessToken()` (auto-refresh)

**Performance business logic (`src/lib/performance.ts`):**
- [x] `computePerformanceBadge()` — viral/converting/underperforming/null
- [x] `computeRoi()`, `shouldCreateSnapshot()`, `computeDaysSincePost()`

**Performance CRUD (`/api/projects/[id]/performance`):**
- [x] POST — create performance record with ROI + badge computation
- [x] GET — read performance + snapshots + completedRun
- [x] PATCH — update metrics, recompute ROI + badge, auto-create daily snapshot

**Analytics aggregate routes:**
- [x] `GET /api/analytics/dashboard` — KPIs: totalRuns, trackedRuns, totalRevenue, avgRoi, bestPerformer, badgeCounts
- [x] `GET /api/analytics/leaderboard?sort=views|gmv|roi&limit=N` — sorted video_performance
- [x] `GET /api/analytics/breakdown?dimension=tone|category|influencer|hook_score` — grouped aggregates

**TikTok OAuth routes:**
- [x] `GET /api/tiktok/auth` — generate OAuth URL + CSRF state
- [x] `GET /api/tiktok/callback` — exchange code, fetch user info, upsert connection
- [x] `GET /api/tiktok/status` — check connection, auto-refresh expired tokens
- [x] `DELETE /api/tiktok/disconnect` — remove connection

**TikTok sync route:**
- [x] `POST /api/tiktok/sync` — batch sync metrics from TikTok Display API, update ROI + badge, create snapshots

**Frontend (wired to live APIs):**
- [x] `/analytics` page with "Battle Report" header, Analytics link in nav (magenta Materia dot)
- [x] KPI cards: live from `/api/analytics/dashboard` (camelCase→snake_case mapping)
- [x] Runs tab: filterable list with search, status pills, tone/category dropdowns, pagination (mock data — no `/api/analytics/runs` endpoint yet)
- [x] Run rows: recipe info (product, tone, character, hook score, cost) + metrics (views, sales, revenue, ROI) + TikTok URL input
- [x] Performance badges: viral (lime), converting (electric), underperforming (magenta), unlinked (muted), pending (amber-hot + pulse)
- [x] Leaderboard tab: self-fetching from `/api/analytics/leaderboard?sort=X&limit=5`, top 5 horizontal bars with toggle (Revenue/Views/ROI)
- [x] Breakdown tab: self-fetching from `/api/analytics/breakdown?dimension=X`, dimension selector (Tone/Category/Avatar → maps to `influencer` API param), grouped MetricBars
- [x] Empty states: no-runs (archive CTA)

**Remaining (deferred — not blocking v1):**
- [ ] Time-series lifecycle curves (day 1, 3, 7, 14, 30) — snapshots table ready, needs frontend charting
- [ ] Insights engine — "Your best tone for supplements is..." (needs enough data to be meaningful)
- [ ] Feedback loop into generation — surface top patterns, weight template selection (R2.1+ scope)

#### R2.1 - Hook A/B Testing & Analytics
**Priority:** P1 - High
**Effort:** Medium
**Depends on:** R2.0 (performance data needed to measure which hooks actually win)
**Why:** TikTok's algorithm rewards the first 3 seconds. Users need to test multiple hooks to find what converts.

- [ ] Generate 3-5 hook variants per project (different tones, angles, templates)
- [ ] Side-by-side hook comparison UI
- [ ] Quick-render hook-only clips (first 15s) for rapid testing
- [ ] Track which hooks score highest across projects (build institutional knowledge)
- [ ] Connect hook variants to R2.0 performance data: which hook version drove the most engagement/sales

#### R2.2 - Trend-Aware Script Generation
**Priority:** P1 - High
**Effort:** Large
**Why:** Viral content follows trends. Static templates become stale. Users need scripts that ride current waves.

- [ ] TikTok trending sounds/formats detection (scraping or API)
- [ ] Trending hook pattern database (updated weekly)
- [ ] Trend-matching in ScriptingAgent: "This product would work with the [trend] format"
- [ ] Seasonal/event awareness (Black Friday, Valentine's Day, back-to-school)
- [ ] Template performance tracking: which templates produce highest-scoring scripts

#### R2.3 - Avatar Consistency & Brand Kit
**Priority:** P1 - High
**Effort:** Medium
**Why:** TikTok Shop sellers build trust through consistent influencer personas. One-off random avatars don't build followings.

- [ ] Persistent avatar identity: Same visual character across all videos for a seller
- [ ] Avatar style guide: Locked-in appearance, wardrobe variations, consistent setting
- [ ] Brand kit: Logo placement, brand colors for text overlays, watermark
- [ ] Avatar gallery: Preview all 11 characters with sample keyframes before selecting
- [ ] Custom avatar upload: Users bring their own reference images

#### ~~R2.4 - Product Image Integration~~ ~~DONE~~ (backend)
**Priority:** P1 - High
**Effort:** Small
**Status:** Complete (2026-02-15). Multi-angle product images with per-segment angle-aware selection and async background removal.
**Why:** Real product images in videos dramatically increase conversion. Currently the pipeline generates AI representations of products, which can look off-brand.

- [x] Accept product image uploads (multiple angles) — `product_image` table with angle/is_primary/url_clean columns. CRUD: `GET/POST /api/products/:id/images`, `PATCH/DELETE /api/products/:id/images/:imageId`. Auto-seed from analysis.
- [x] Composite real product images into generated video frames — CastingAgent `selectProductImageForSegment()` selects best angle per segment via `VISIBILITY_ANGLE_MAP`. Legacy fallback to `project.product_image_url`.
- [x] Product image enhancement (background removal, lighting correction) — async bg removal via WaveSpeed editImage on upload, stored in `url_clean`. 4K upscale on upload.
- [x] Product placement choreography matching the PRODUCT_PLACEMENT_ARC — segment 0 none (no product ref), segment 1 lifestyle/side, segment 2 front/label (hero), segment 3 front/side

#### ~~R2.5 - Reference Video Intelligence~~ DONE *(completed as R1.3)*
**Status:** Complete (2026-02-15) — Implemented ahead of schedule as part of Tier 1 (R1.3).
See R1.3 above for full implementation details.

#### R2.6 - Campaign Dashboard
**Priority:** P2 - Medium (backlog)
**Effort:** Medium
**Depends on:** R2.0 (performance tracking provides the data layer)
**Why:** UGC creators run campaigns — multiple videos for the same product across different tones, hooks, and avatars. There's no way to group videos by product/campaign, track aggregate spend, or see which video in a campaign performs best. A campaign dashboard groups projects by product, shows aggregate cost/performance, and provides a calendar view for planning production schedules. Inspired by Studiovity's budgeting and scheduling tools, adapted for AI UGC creators.

- [ ] Campaign entity: group multiple projects by product into a named campaign (e.g., "Summer Vitamin C Push")
- [ ] Campaign list page: cards showing product, video count, total cost, status breakdown, top performer
- [ ] Campaign detail page: all videos in the campaign with cost and performance metrics side-by-side
- [ ] Campaign-level cost tracking: aggregate spend across all videos, cost-per-video trend chart
- [ ] Campaign calendar: schedule planned video production dates and TikTok publish dates
- [ ] Performance aggregation: total views, total revenue, best/worst video, ROI per campaign
- [ ] "New Video for Campaign" button: pre-fills create project form with campaign product + suggested variation (different tone/hook)

---

### Tier 3: Scale & Efficiency (Go from 1 video to 100)

#### R3.1 - Batch Video Generation
**Priority:** P2 - Medium
**Effort:** Medium
**Why:** Power users want to generate multiple videos per product (different tones, hooks, avatars) and multiple products per session.

- [ ] Multi-tone batch: Generate the same product video in 3-5 different tones simultaneously
- [ ] Multi-avatar batch: Same script, different character presentations
- [ ] Batch queue management: Priority ordering, pause/resume, cost estimation before run
- [ ] CLI mode: `npm run generate -- --url="..." --tones="big-sis,tired-expert" --count=3`
- [ ] Auto-approve mode for experienced users who trust the pipeline

#### R3.2 - Template & Script Library
**Priority:** P2 - Medium
**Effort:** Small
**Why:** Users iterate. Let them save and reuse what works.

- [ ] Save successful scripts as reusable templates
- [ ] "Clone project" - Create a new video from an existing project's script/settings
- [ ] Script library with search and filtering (by category, tone, hook score)
- [ ] Community templates: Share/import high-scoring scripts (future)
- [ ] Favorite scripts and segments for quick access

#### R3.3 - Cost Optimization & Rendering
**Priority:** P2 - Medium
**Effort:** Large
**Why:** At $5.58/video, heavy users hit cost friction fast. Self-hosted rendering cuts the biggest expense.

- [ ] FFmpeg-based local rendering (replace Creatomate, saves ~$1-3 per video)
- [ ] Image generation model alternatives (compare cost/quality across providers)
- [ ] Caching: Reuse character keyframes across videos with same avatar
- [ ] Preview mode: Lower-quality renders for review, full quality only on approval
- [ ] Cost dashboard: Per-project and monthly spend tracking

---

### Tier 4: Growth & Monetization

#### R4.1 - Multi-User & Teams
**Priority:** P3 - Low (until product-market fit)
**Effort:** Large
**Why:** Required for SaaS, but premature before validating core loop.

- [ ] User authentication (Supabase Auth)
- [ ] Project ownership and access control
- [ ] Team workspaces with shared character libraries
- [ ] Usage-based billing integration (Stripe)
- [ ] Role-based permissions (creator, reviewer, admin)

#### R4.2 - TikTok Direct Publishing
**Priority:** P3 - Low
**Effort:** Medium
**Why:** Convenience feature. Reduces friction but not blocking.

- [ ] TikTok Creator API integration
- [ ] Schedule posts directly from the app
- [ ] Auto-generate TikTok captions and hashtags from script
- [ ] Performance tracking: Views, likes, sales attribution

#### R4.3 - Multi-Platform Support
**Priority:** P3 - Low
**Effort:** Medium
**Why:** Natural expansion once TikTok is nailed. Same content, different formats.

- [ ] Instagram Reels format (9:16, 60s, different text overlay rules)
- [ ] YouTube Shorts format (9:16, 60s)
- [ ] Platform-specific CTA optimization
- [ ] Aspect ratio variations (1:1 for feed posts)

#### R4.4 - AI Influencer Marketplace
**Priority:** P3 - Future
**Effort:** Large
**Why:** Endgame monetization. Users create and license AI influencers to other sellers.

- [ ] Custom AI influencer creation (face, voice, personality)
- [ ] Influencer licensing marketplace
- [ ] Performance-based influencer rankings
- [ ] Revenue sharing model

---

## Recommended Execution Order

```
DONE       Tier 0: Critical Bugs (B0.1-B0.25, B0.36)
DONE       Tier 1: Core Pipeline (R1.1, R1.2, R1.4, R1.5, R1.6)
           ▲ Full end-to-end pipeline functional: URL → analysis → script → casting → directing → voiceover → editing → finished video

DONE       R1.7 B-Roll Agent
           ScriptingAgent cues → B-Roll planning → Storyboard review → B-Roll generation → EditorAgent compositing
           (timestamps in script)  (LLM shot list)  (user edits/approves)  (Nano Banana Pro)   (Ken Burns overlay)
           ▲ Two-phase: plan at script review, generate after directing. ~$0.85-1.13 added cost per video.

MVP ──→    Validate: Run real product URLs through full pipeline with B-roll. Ship when videos are watchable.

BUGS ──→   Tier 0 Bug Bash Findings (fix BEFORE any new Tier 1.5 work)
           ~~B0.27 Director cost double-charge on retry~~ ~~FIXED~~
           ~~B0.28 B-roll stages missing from rollback map (recovery blocked)~~ ✅ FIXED
           ~~B0.26 EditorAgent retry logic (elevated to High — $5-7 at stake)~~ ✅ FIXED
           ~~B0.29 Select-influencer race condition (duplicate casting jobs)~~ ✅ FIXED
           ~~B0.30 Keyframe ref image ordering broken (influencer drift + product overrides ignored)~~ ✅ FIXED
           ~~B0.32 Video prompt missing dialogue text (Kling has no script context)~~ ✅ FIXED
           ~~B0.33 Video regeneration button not working (z-index / event interception)~~ ✅ FIXED
           ~~B0.40 END frame reference image ordering (face drift across segments)~~ ✅ FIXED

POLISH     Tier 1.5: UX Hardening
           R1.5.1 Influencer edit ──→ R1.5.2 Project settings ──→ R1.5.3 Navigation ──→ R1.5.4 Error handling (ALL DONE)
           R1.5.5 Engineering Roadmap Kanban Dashboard ✅ DONE
           R1.5.6 FF7 Visual Theme ✅ DONE
           R1.5.7 Direct-to-Storage Uploads ✅ DONE
           R1.5.8 Navigable Pipeline Stages ✅ DONE
           R1.5.9 Scene & Interaction Presets ✅ DONE
           R1.5.10 Visual Script Breakdown ✅ DONE
           R1.5.11 Keyframe Consistency ✅ SUPERSEDED (chained keyframe generation prevents drift)
           R1.5.12 Projects Quest Board ✅ DONE (FF7 World Map Kanban — depends on R1.5.6 ✅)
           R1.5.13 Influencer 4K Upscale ✅ DONE (inline at upload time)
           R1.5.15 Project sequential numbering (PROJECT-N)
           R1.5.16 Video Model Selection & Pipeline Abstraction (backend done, frontend selector + 2 agents remaining)
           R1.5.19 Structured Prompt Schema ✅ DONE (depends on R1.5.16 — uses model-specific negative prompts)
           R1.5.20 Influencer Voice Design System ✅ DONE (voice as first-class influencer attribute, mute Kling audio)
           R1.5.24 ElevenLabs Voice ID Reference ✅ DONE (replaces R1.5.20 Voice Design API — paste Voice ID instead of in-app design)
           R1.5.26 Scripting validation enforcement ──→ R1.5.27 LLM retry in BaseAgent (standardize retry across all agents)
           (reject bad scripts, auto-regen)           (protect ProductAnalyzer + ScriptingAgent from single-failure KO)
           R1.5.28 ElevenLabs rate limit protection (500ms delay + 429 retry in VoiceoverAgent)
           R1.5.29 Video Generation Preview & Test Mode (preview Kling payload, test 1 segment, Fast Mode toggle)
           R1.5.21 Parallel Directing + Voiceover (~5 min savings per run, no deps)
           R1.5.22 B-Roll Timing in EditorAgent (depends on Creatomate template work)
           R1.5.23 Smart Cascade Editing — per-segment regeneration after script edits (depends on R1.5.8 ✅)
           R1.5.25 Asset Download for All Generated Media ✅ DONE
           R1.5.35 Invalidate Stale Video Previews on Keyframe Regen ✅ DONE (depends on R1.5.23 — cancels video assets when keyframe changes)

NEXT       Tier 2: Quality & Conversion
           R2.0b Lip Sync Post-Processing ⬅ HIGH PRIORITY (biggest quality gap — lips don't match voiceover)
           R2.0 Performance Tracking ✅ DONE (backend) ──→ R2.4 Product Images ✅ DONE (backend) ──→ R2.3 Avatar Consistency ──→ R2.1 Hook Testing ──→ R2.2 Trends
           (data foundation complete)                        (multi-angle + bg removal)               (builds trust)             (optimizes output)    (stays fresh)
           ▲ R2.0 fully wired (KPIs, leaderboard, breakdown live; RunTable still mock). R2.4 backend done. R2.5 already done as R1.3.

THEN       Tier 3: Scale
           R3.2 Script Library ──→ R3.1 Batch Generation ──→ R3.3 Cost Optimization
           (easy, high value)      (power users)             (margin improvement)

LATER      Tier 4: Growth
           R4.1 Multi-User ──→ R4.2 TikTok Publishing ──→ R4.3 Multi-Platform ──→ R4.4 Marketplace
           (when PMF confirmed)   (auto-links runs to posts)
```

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI avatar quality inconsistency | Users reject output, churn | Avatar consistency system (R2.3), human review gates, quality scoring |
| $5.58/video cost too high for SMB sellers | Price-sensitive market | Cost optimization (R3.3), preview mode, caching |
| Generated videos don't convert (no sales) | Product fails to deliver value | Reference video intelligence (R1.3), hook A/B testing (R2.1), trend awareness (R2.2) |
| TikTok policy changes on AI-generated content | Platform risk | Multi-platform support (R4.3), content disclosure compliance |
| Kling 3.0 / WaveSpeed API reliability | Pipeline failures block users | Retry logic (R1.1), structured logging + API call audit trail (R1.4), fallback providers |
| Blind debugging of production failures | Hours wasted guessing root cause | Pipeline observability (R1.4), version tagging (R1.5), generation_log table |
| Competitor clones with better models | Market share loss | Vertical integration (reference video intelligence is defensible moat) |
| Worker crash leaves projects stuck | Users see infinite loading, lose trust | Pipeline timeout detection + retry UI (R1.1), status guards on deletion (B0.3) |
| Data integrity from broken FK cascades | Orphaned records, broken project loads | FK guard on influencer deletion (B0.2), transactional deletes |
| Cost underreporting from untracked regenerations | Users surprised by actual spend | Fix cost tracking on all LLM calls (B0.6), cost confirmation dialogs (R1.1) |
| No auth = public API endpoints | Anyone can delete data | Acceptable for single-user MVP; must fix before multi-user (R4.1) |

---

## Success Metrics

**Production Metrics (Tier 1)**
| Metric | Target (MVP) | Target (6 months) |
|--------|-------------|-------------------|
| End-to-end pipeline completion rate | 70% | 90% |
| Time from URL to finished video | < 30 min | < 15 min |
| Average cost per video | < $6 | < $3 |
| Script hook score (avg) | 10/14 | 12/14 |
| User-approved on first generation (no regen) | 30% | 50% |
| Videos generated per user per week | 2 | 10+ |

**Performance Metrics (Tier 2 - R2.0, tracked per completed run)**
| Metric | Target (3 months post-R2.0) | Target (6 months post-R2.0) |
|--------|---------------------------|----------------------------|
| % of completed runs linked to TikTok posts | 50% | 80% |
| Average views per generated video | 5,000 | 25,000 |
| Average ROI per run (revenue / $5.58 cost) | 3x | 10x |
| Videos with >2% conversion rate | 20% | 40% |
| Avg TikTok completion rate (watch-through) | 30% | 50% |
| Revenue-positive runs (GMV > cost) | 60% | 85% |

---

## Decision Points for Admin Review

1. **Creatomate vs. FFmpeg for Phase 4?** Creatomate is faster to integrate but adds per-render cost. FFmpeg is free but requires more engineering. Recommendation: Start with Creatomate, migrate to FFmpeg in R3.3.

2. **Reference video analysis scope (R1.3)?** Full video analysis is complex. Could start with manual input (user describes what they liked about the reference) vs. automated analysis. Recommendation: Start automated - this is the moat.

3. **When to add auth (R4.1)?** Currently single-user. Adding auth before PMF adds friction. Recommendation: Defer until 5+ active users or paid launch.

4. **Batch vs. single video focus?** Power users want batch. But quality per video matters more early on. Recommendation: Nail single video quality (Tier 2) before batch (Tier 3).

5. **TikTok data ingestion for R2.0?** Three approaches with increasing automation: (a) Manual input - user pastes post URL and enters metrics by hand, (b) TikTok Content Publishing API - pull metrics automatically for posts published via the API, (c) TikTok Research API or scraping - pull metrics for any post URL. Recommendation: Start with (a) manual + (b) API for self-published posts. Option (c) has compliance risk and access barriers. R4.2 (Direct Publishing) naturally upgrades to (b) when built.

---

*This roadmap is a living document. Priorities should be reassessed after each tier completion based on user feedback and market signals.*
