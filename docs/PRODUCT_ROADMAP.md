# TikTok Creator App - Product Roadmap

**Author:** Product Management
**Date:** 2026-02-15
**Status:** DRAFT - Pending Admin Approval
**Last audit:** 2026-02-15 (codebase bug + UX audit)

---

## Executive Summary

TikTok Creator App is an AI-powered pipeline that produces 60-second TikTok Shop UGC videos using AI-generated influencers. The target customer is a TikTok Shop seller who wants to produce high-converting viral product videos at scale using AI avatars, drawing creative inspiration from existing viral TikTok content.

**Core value proposition:** Collapse the 3-7 day, $500-2,000 UGC creation cycle into a 15-minute, ~$5 automated pipeline with human-in-the-loop quality gates.

---

## Current State Assessment

### What's Built (Phases 1-2: Complete)
- Full project scaffold with Next.js 16, Supabase, BullMQ
- **ProductAnalyzerAgent** - Extracts structured product data from TikTok Shop URLs
- **ScriptingAgent** - Generates 4-segment, 60-second scripts with syllable validation, hook scoring (14-point scale), and 10 psychologically-targeted tone presets
- Human review gates at analysis and script stages
- Script versioning, per-segment editing, regeneration with feedback
- Script upload (user-provided scripts)
- Dark cinematic frontend with pipeline visualization

### What's In Progress (Phase 3: ~40%)
- CastingAgent, DirectorAgent, VoiceoverAgent stubs exist
- ElevenLabs API client built
- Asset review components created
- Currently limited to segment 0 only (test mode)

### What's Not Started
- Video composition/editing (Phase 4)
- CLI/batch mode (Phase 5)
- Self-hosted rendering (Phase 6)

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
PATCH endpoint added for name/persona updates.

#### ~~B0.8 - CastingAgent Crashes: WaveSpeed `num_images` Parameter~~ FIXED
Changed `num_images` from 1 to 2 in `wavespeed.ts`. Poll result already picks first image from the pair via `outputs?.[0]`.

#### ~~B0.9 - No Product Image Captured During Analysis~~ FIXED
- Added `product_image_url` column to `project` table (migration applied)
- Pipeline worker saves extracted image URL to project column during analysis
- Analysis review UI displays product image with preview
- Upload fallback via `POST /api/projects/[id]/product-image` (stores in Supabase Storage `assets/products/{id}/`)
- Broken/missing image shows upload prompt with amber warning styling
- Hard gate: approve button disabled without a valid product image; API returns 400 if no image present

#### B0.10 - Failed Pipeline Has No Recovery Path
**Severity:** Critical - Complete dead end
**What:** When the pipeline fails at any stage (e.g., casting crash from B0.8), the project status is set to `failed` and the user sees the error message, but there is no way to recover. No "Retry" button, no "Go back to last review stage" option. The only option is to delete the project and start from scratch, losing all prior work (analysis, approved script, etc.).
**Impact:** Every pipeline failure forces the user to redo the entire workflow from product URL entry. For failures at late stages (directing, voiceover), this wastes minutes of work and real API costs ($0.01-$5+). This is the single biggest UX frustration for any user hitting a transient error.
**Fix scope:**
- [ ] Add a "Retry" button on failed projects that re-enqueues the failed stage (e.g., if casting failed, retry casting with same inputs)
- [ ] Add a "Back to [last review stage]" button that resets status to the previous human gate (e.g., failed at casting → go back to `script_review`, failed at directing → go back to `casting_review`)
- [ ] Preserve all existing work: scripts, assets generated before failure, cost tracking
- [ ] Show which stage failed in the pipeline progress UI (highlight the failed step in red, not just the generic "FAILED" badge)
- [ ] API: `POST /api/projects/[id]/retry` — re-enqueue the last attempted stage
- [ ] API: `POST /api/projects/[id]/rollback` — reset status to the previous review gate

#### ~~B0.5 - Project List Stale After Creation~~ FIXED
Added `router.refresh()` before navigation after project creation to invalidate the client-side Router Cache.

#### ~~B0.6 - Cost Not Tracked on Regeneration~~ FIXED
Made `BaseAgent.trackCost()` atomic via Postgres `increment_project_cost` RPC function. All agents (including regeneration paths) now use race-condition-safe cost increments.

#### ~~B0.7 - Schema Documentation Drift~~ FIXED
Updated `src/db/schema.ts` with `influencer` table, `completed_run` table, and missing columns (`tone`, `influencer_id`, `source`, `version`).

---

### Tier 1: Complete the Core Pipeline (Ship a working end-to-end product)

These are blocking items. Nothing else matters until a user can go from product URL to finished video.

#### R1.1 - Complete Asset Generation (Phase 3)
**Priority:** P0 - Critical
**Effort:** Medium-Large
**Depends on:** ~~B0.1~~ ~~B0.8~~ ~~B0.9~~ (all fixed)
**Why:** Without this, the product is a script generator, not a video creator.

**Pre-casting gate (new review step between script_review and casting):**
- [ ] **Influencer selection gate:** When user approves a script, prompt them to select or confirm the AI influencer before casting begins. Show the influencer's reference image so the user knows what avatar the keyframes will use. If no influencer is assigned, require one before proceeding.
- [ ] **Product image requirement:** Before casting can start, validate that a product image exists (from analysis or user upload). If `product_image_url` is empty/broken, block casting and show an upload prompt. Rule: never generate keyframes without a real product reference image.
- [ ] **Product interaction prompt:** Let the user specify how the product appears in keyframes per segment. Options per the existing `PRODUCT_PLACEMENT_ARC`: (Seg 1: not visible, Seg 2: subtle background, Seg 3: hero shot - holding/showing, Seg 4: set down in frame). User should be able to override defaults and add notes (e.g., "influencer holds bottle at eye level", "product on desk next to laptop").

**Pipeline hardening:**
- [ ] Enable full 4-segment processing (remove single-segment test restriction)
- [ ] Harden CastingAgent: error recovery, retry logic, image quality validation
- [ ] Harden DirectorAgent: video generation polling, timeout handling, quality checks
- [ ] Harden VoiceoverAgent: voice caching on character records, audio duration validation
- [ ] Asset review UI: per-segment image/video/audio preview with approve/reject/regenerate per-asset
- [ ] Cost confirmation dialog before expensive operations (casting: ~$0.56, directing: ~$4.80) — currently only asset_review has one
- [ ] Cost tracking: display running cost per project in UI during all pipeline stages (not just completed)
- [ ] Worker crash recovery: detect stuck pipelines (no status change for >10 min), expose "Retry" / "Reset" button in UI
- [ ] Pipeline timeout detection: if project stays in a processing status beyond expected duration, surface a warning to the user

#### R1.2 - Video Composition (Phase 4 - EditorAgent)
**Priority:** P0 - Critical
**Effort:** Large
**Why:** The final deliverable. Without this, users have raw assets but no finished video. Currently the `editing` status exists in the pipeline but has zero UI or backend handling — the product dead-ends at `asset_review`.

- [ ] EditorAgent: Compose 4 video segments + voiceover audio + text overlays into 60s video
- [ ] Integration with Creatomate (or FFmpeg as fallback)
- [ ] Text overlay rendering (hook text, CTA text from script)
- [ ] Transition effects between segments
- [ ] Handle `editing` status in ProjectDetail UI (currently shows blank — no component, no progress indicator)
- [ ] Final review page: video player, download button, share link
- [ ] Render status tracking and progress indicator
- [ ] **Run archive:** On final approval, persist the completed run as an immutable record — snapshot the full "recipe" (product data, script version, tone, avatar, template, hook score, all asset URLs, final video URL, total cost) into a `completed_run` record. This is the unit of measurement for everything downstream.

#### R1.3 - Reference Video Intelligence
**Priority:** P0 - Critical
**Effort:** Medium
**Why:** This is the core differentiator. "Drawing influence from existing TikTok videos" is the stated customer need. The `video_url` input field exists but does nothing today.

- [ ] Video analysis agent: Download and analyze reference TikTok videos
- [ ] Extract pacing, hook style, energy arc, visual composition from reference
- [ ] Feed reference analysis into ScriptingAgent (match proven viral patterns)
- [ ] Feed reference analysis into DirectorAgent (match camera work, transitions)
- [ ] UI: Show reference video alongside generated output for comparison

---

### Tier 1.5: UX Hardening (Polish before scaling)

Ship-blocking bugs are fixed (Tier 0) and the pipeline works end-to-end (Tier 1). Before optimizing for conversions (Tier 2), harden the UX so the tool is pleasant to use repeatedly.

#### R1.5.1 - Influencer Management Completion
**Priority:** P0.5 - High (CRUD is incomplete)
**Effort:** Small
**Why:** Influencers are a core entity. Users can create and delete but can't edit. This is table-stakes CRUD.

- [ ] PATCH endpoint for influencers (edit name, persona)
- [ ] Image re-upload / replacement on influencer detail page
- [ ] Edit mode toggle on influencer detail page
- [ ] Prevent deletion of influencers assigned to active projects (or show warning with project list)

#### R1.5.2 - Project Settings Editing
**Priority:** P1 - Medium
**Effort:** Small
**Why:** Users can't change tone, character, or influencer after project creation. Must delete and recreate.

- [ ] Editable project settings on detail page (tone, character, influencer) — only when status is at a review gate
- [ ] "Restart pipeline" option: re-run from a specific stage with changed settings (e.g., change tone and re-run scripting)

#### R1.5.3 - Navigation & State Consistency
**Priority:** P1 - Medium
**Effort:** Small
**Why:** Several small UX gaps that create friction across pages.

- [ ] Back links on creation pages (`/projects/new`, `/influencers/new`)
- [ ] Link from project detail to assigned influencer (clickable, not just text)
- [ ] Pagination or virtual scroll on project/influencer lists (breaks at 50+ items)
- [ ] Search/filter on project list (by status, category, name)
- [ ] Consistent empty states across all list views

#### R1.5.4 - Error Handling & Recovery
**Priority:** P1 - Medium
**Effort:** Medium
**Why:** Most components silently swallow errors. Users see blank states with no explanation.

- [ ] Error boundary component with retry button for failed data fetches
- [ ] Error state display in ScriptReview, AssetReview (currently console.error only)
- [ ] Network failure recovery: exponential backoff on polling, offline indicator
- [ ] Failed pipeline recovery: surface error_message on project card (not just detail page)
- [ ] Status transition validation: prevent invalid status jumps via API

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
FIRST      Tier 0: Critical Bugs
           B0.10 Failed pipeline recovery
           (retry/rollback on failure)
           Note: B0.1-B0.9 all fixed

NOW        Tier 1: Complete Pipeline
           R1.1 Asset Generation ──→ R1.2 Video Composition + Run Archive ──→ R1.3 Reference Video Intel
           (finish what's started)    (ship the deliverable)                   (core differentiator)

POLISH     Tier 1.5: UX Hardening
           R1.5.1 Influencer CRUD ──→ R1.5.2 Project editing ──→ R1.5.3 Navigation ──→ R1.5.4 Error handling
           (complete the basics)       (reduce friction)          (state consistency)   (graceful failures)

NEXT       Tier 2: Quality & Conversion
           R2.0 Performance Tracking ──→ R2.4 Product Images ──→ R2.3 Avatar Consistency ──→ R2.1 Hook Testing ──→ R2.2 Trends
           (close the feedback loop)     (quick win, big impact)  (builds trust)             (optimizes output)    (stays fresh)
           ▲ data foundation for R2.1, R2.2, and Tier 3 decisions

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
| Kling 3.0 / WaveSpeed API reliability | Pipeline failures block users | Retry logic (R1.1), fallback providers, graceful degradation |
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
