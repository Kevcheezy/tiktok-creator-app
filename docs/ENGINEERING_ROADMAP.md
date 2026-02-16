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
- **CastingAgent** — Keyframe image generation via WaveSpeed Nano Banana Pro, influencer reference image editing, per-segment retry
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
| Keyframe Images (8 images) | $0.56 |
| Video Generation (4 segments) | $4.80 |
| Voiceover (4 segments) | $0.20 |
| **Total per video** | **~$5.58** |

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

#### R1.7 - B-Roll Agent
**Priority:** P0 - Critical
**Effort:** Medium-Large
**Depends on:** R1.1 (pipeline must handle casting/directing/voiceover before B-roll generation phase runs)
**Spec:** `docs/plans/2026-02-15-r1.7-broll-agent-design.md`
**Why:** High-performing TikTok Shop content uses B-roll inserts (cutaway images) to maintain viewer attention and validate claims. Without B-roll, videos are a single visual layer — flat and monotonous. B-roll is a visual argument that reinforces the script's persuasion structure. The agent operates in two phases: planning (at script review) and generation (after directing).

**ScriptingAgent integration:**
- [ ] Add `broll_cues` field to scene table — timestamps, duration, intent, spoken text for each B-roll insert
- [ ] ScriptingAgent generates cues alongside shot_scripts and audio_sync
- [ ] Cues timed for ~2-3 second visual refresh intervals (short-form virality best practice)

**B-Roll planning (Phase 1 — after script approval, before influencer selection):**
- [ ] B-RollAgent.plan() reads approved script + broll_cues + product category
- [ ] Selects `BROLL_PRESETS` for product category (10 category-aware presets: transformation, research, lifestyle, social_proof, unboxing, comparison, etc.)
- [ ] Shot count per segment: `ceil(syllable_count / 20)`, min 2, max 6
- [ ] LLM generates categorized prompts with narrative roles for each shot
- [ ] New `broll_shot` table stores planned shots (prompt, category, timing, duration, status)
- [ ] New pipeline statuses: `broll_planning`, `broll_review`

**Storyboard view (user reviews B-roll plan):** 🔧 IN PROGRESS (UI shell with mock data)
- [ ] Vertical 60-second timeline showing script text + B-roll cards per shot_script
- [ ] Edit prompt, change category, adjust timing/duration, remove, add, reorder
- [ ] Upload own image to replace any AI-generated shot
- [ ] Summary bar: total count, estimated cost, per-category breakdown
- [ ] Approve → proceeds to influencer_selection

**B-Roll generation (Phase 2 — after directing + voiceover):**
- [ ] B-RollAgent.generate() creates still images via Nano Banana Pro ($0.07/image)
- [ ] Skips user-uploaded shots (already have image_url)
- [ ] New pipeline status: `broll_generation`
- [ ] Assets stored as type `broll` with timing metadata for EditorAgent

**EditorAgent integration:**
- [ ] EditorAgent reads broll_cues (timestamps) + broll_shot records (images)
- [ ] Composites B-roll as cutaway overlays at exact offset_seconds with duration_seconds
- [ ] Applies Ken Burns effect (zoom/pan) for motion on still images

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

#### R1.5.5 - Engineering Roadmap Kanban Dashboard
**Priority:** P1 - Medium
**Effort:** Medium
**Spec:** `docs/plans/2026-02-15-r1.5.5-kanban-dashboard-design.md`
**Why:** The engineering roadmap lives in `ENGINEERING_ROADMAP.md` — a long markdown file that's hard to scan for current status. A `/roadmap` page parses the markdown at render time into a live Kanban board (Backlog / In Progress / Done) with FF7 character workers assigned by domain. The markdown remains the single source of truth.

**Backend:**
- [ ] Markdown parser: extracts task ID, title, status, tier, priority, effort, dependencies, spec path, checkboxes, description, cost impact from ENGINEERING_ROADMAP.md
- [ ] `GET /api/roadmap` returns parsed tasks + summary statistics + last git commit info
- [ ] `GET /api/roadmap/workers` returns FF7 worker list with task counts
- [ ] `PATCH /api/roadmap/assign` stores/updates worker override in `roadmap_worker` table
- [ ] `roadmap_worker` table created via Supabase migration
- [ ] Auto-assignment heuristic: domain keywords → FF7 character mapping (Cloud=Backend, Tifa=Frontend, Barret=Infra, Aerith=PM, Red XIII=QA)

**Frontend:**
- [ ] `/roadmap` page with Kanban board (3 columns: Backlog, In Progress, Done)
- [ ] Worker bar with FF7 character avatars and active task counts (filter by clicking)
- [ ] Task cards with worker avatar, tier badge, progress bar (from checkboxes), dependencies, cost
- [ ] Card click expands to full detail view (all checkboxes, spec link, description)
- [ ] Worker reassignment dropdown on cards
- [ ] Filter by tier (dropdown), search by task ID/title
- [ ] Auto-poll every 30 seconds for live updates
- [ ] "Roadmap" tab in navigation
- [ ] Smooth animations: card column transitions, progress bar updates, worker avatar pulse

#### R1.5.6 - Direct-to-Storage Image Uploads
**Priority:** P2 - Medium (backlog)
**Effort:** Small
**Why:** Influencer reference photos are currently routed through the Next.js API, which is constrained by Vercel's 4.5 MB body limit. Images are compressed client-side to fit, but the pipeline needs full-resolution photos for high-quality keyframe generation via CastingAgent. Uploading directly to Supabase Storage from the frontend bypasses the API route size limit entirely.

- [ ] Frontend uploads images directly to Supabase Storage (signed upload URL or anon key with Storage RLS)
- [ ] API route receives the storage path/URL instead of the file blob
- [ ] Apply same pattern to product image upload (`/api/products/[id]/image`) and project product image (`/api/projects/[id]/product-image`)
- [ ] Remove client-side compression workaround once direct uploads are in place

---

### Tier 2: Make It Actually Convert (Quality & conversion optimization)

These features separate "generates a video" from "generates a video that sells."

#### R2.0 - Performance Tracking & KPI Dashboard
**Priority:** P1 - High (first in Tier 2 - data foundation for everything below)
**Effort:** Medium
**Why:** Without closing the feedback loop, every optimization is guesswork. This connects generated videos to actual TikTok performance and revenue, turning the app from a production tool into a learning system. Also the data foundation that R2.1 (Hook Testing) and R2.2 (Trends) depend on.

**Run-level tracking (per completed video):**
- [ ] Link completed runs to TikTok post URLs (manual input initially, auto-detect with R4.2)
- [ ] Pull TikTok engagement metrics via API: views, likes, comments, shares, avg watch time, completion rate
- [ ] Pull TikTok Shop attribution: units sold, GMV (gross merchandise value), conversion rate, add-to-cart rate
- [ ] Calculate ROI per run: revenue generated vs. production cost ($5.58)
- [ ] Run detail page: full recipe snapshot alongside performance metrics over time
- [ ] Performance status badges: viral (100k+ views), converting (>2% CVR), underperforming

**Aggregate analytics (cross-run intelligence):**
- [ ] KPI dashboard: total runs, total revenue attributed, avg ROI, best/worst performers
- [ ] Leaderboard: Top-performing videos ranked by revenue, engagement, or ROI
- [ ] Breakdown by dimension: performance by tone, avatar, hook template, product category, hook score
- [ ] Time-series: Video performance lifecycle curves (day 1, 3, 7, 14, 30)
- [ ] Insights engine: "Your 'converted-skeptic' tone generates 3.2x more revenue than 'calm-pro' for supplements"

**Feedback loop (feed learnings back into generation):**
- [ ] Surface top-performing recipe patterns when creating new projects ("For skincare, your best results used: big-sis tone + dermatologist avatar + curiosity gap hook")
- [ ] Weight script template selection by real-world performance (not just least-used)
- [ ] Flag underperforming patterns: "The 'quiet-minimalist' tone has 0% conversion rate for fitness products"

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

#### R2.4 - Product Image Integration
**Priority:** P1 - High
**Effort:** Small
**Why:** Real product images in videos dramatically increase conversion. Currently the pipeline generates AI representations of products, which can look off-brand.

- [ ] Accept product image uploads (multiple angles)
- [ ] Composite real product images into generated video frames
- [ ] Product image enhancement (background removal, lighting correction)
- [ ] Product placement choreography matching the PRODUCT_PLACEMENT_ARC

#### ~~R2.5 - Reference Video Intelligence~~ DONE *(completed as R1.3)*
**Status:** Complete (2026-02-15) — Implemented ahead of schedule as part of Tier 1 (R1.3).
See R1.3 above for full implementation details.

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
DONE       Tier 0: Critical Bugs (B0.1-B0.11)
DONE       Tier 1: Core Pipeline (R1.1, R1.2, R1.4, R1.5, R1.6)
           ▲ Full end-to-end pipeline functional: URL → analysis → script → casting → directing → voiceover → editing → finished video

NOW        R1.7 B-Roll Agent
           ScriptingAgent cues → B-Roll planning → Storyboard review → B-Roll generation → EditorAgent compositing
           (timestamps in script)  (LLM shot list)  (user edits/approves)  (Nano Banana Pro)   (Ken Burns overlay)
           ▲ Two-phase: plan at script review, generate after directing. ~$0.85-1.13 added cost per video.

MVP ──→    Validate: Run real product URLs through full pipeline with B-roll. Ship when videos are watchable.

POLISH     Tier 1.5: UX Hardening
           R1.5.1 Influencer edit ──→ R1.5.2 Project settings ──→ R1.5.3 Navigation ──→ R1.5.4 Error handling (ALL DONE)
           R1.5.5 Engineering Roadmap Kanban Dashboard + R1.5.6 Direct-to-Storage Uploads (remaining)
           (markdown parser + FF7 workers + Kanban board)  (bypass Vercel 4.5MB limit)

NEXT       Tier 2: Quality & Conversion
           R2.0 Performance Tracking ──→ R2.4 Product Images ──→ R2.5 Reference Video Intel ──→ R2.3 Avatar Consistency ──→ R2.1 Hook Testing ──→ R2.2 Trends
           (close the feedback loop)     (quick win, big impact)  (core differentiator)         (builds trust)             (optimizes output)    (stays fresh)
           ▲ R2.0 is data foundation for R2.1, R2.2, R2.5, and Tier 3 decisions

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
