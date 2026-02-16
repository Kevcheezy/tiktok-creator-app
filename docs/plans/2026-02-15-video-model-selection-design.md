# R1.5.16: Video Model Selection & Pipeline Abstraction

**Author:** PM Agent
**Date:** 2026-02-15
**Status:** Spec Complete

---

## Problem

The pipeline hardcodes Kling 3.0 Pro assumptions across 7+ files: 4 segments, 15 seconds each, 3 shots per segment, Kling-specific API endpoint, no resolution control. `PIPELINE_CONFIG`, `ENERGY_ARC`, and `PRODUCT_PLACEMENT_ARC` are constants that every agent reads directly. This makes it impossible to:

1. Add alternative video models or formats without touching every agent
2. Control video resolution (current output is not guaranteed 1080p)
3. Let the video model drive the creative structure (segment count, narrative arc, shot choreography)

## Solution

Make "video model" a first-class database entity. Each video model profile defines the full pipeline configuration — technical parameters (segments, duration, resolution, API endpoint) AND creative structure (energy arc, product placement arc, section names). Projects reference a video model. All agents read their config from the project's video model instead of hardcoded constants.

**Initial scope:** One model (Kling 3.0 Pro, 60s, 4x15s, 1080p). The abstraction exists for future models/formats.

---

## Data Model

### New `video_model` table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | random | PK |
| `slug` | text | — | Unique: `kling-3.0-pro` |
| `name` | text | — | "Kling 3.0 Pro" |
| `provider` | text | — | `wavespeed` (routes to correct API client) |
| `api_endpoint` | text | — | `/api/v3/kwaivgi/kling-v3.0-pro/image-to-video` |
| `segment_count` | int | — | `4` |
| `segment_duration` | int | — | `15` (seconds) |
| `shots_per_segment` | int | — | `3` (multishot prompts) |
| `shot_duration` | int | — | `5` (seconds, computed: segment_duration / shots_per_segment) |
| `total_duration` | int | — | `60` (computed: segment_count x segment_duration) |
| `resolution` | text | — | `1080p` |
| `aspect_ratio` | text | `9:16` | TikTok vertical |
| `supports_tail_image` | bool | — | `true` (Kling start/end keyframe feature) |
| `supports_multi_prompt` | bool | — | `true` (Kling multishot) |
| `cost_per_segment` | numeric | — | `1.20` |
| `syllables_per_segment` | jsonb | — | `{ "min": 82, "max": 90, "warnMin": 75, "warnMax": 95, "errorMin": 60, "errorMax": 110 }` |
| `energy_arc` | jsonb | — | Current `ENERGY_ARC` constant (4 entries) |
| `product_placement_arc` | jsonb | — | Current `PRODUCT_PLACEMENT_ARC` constant (4 entries) |
| `section_names` | jsonb | — | `["Hook", "Problem", "Solution + Product", "CTA"]` |
| `is_default` | bool | `false` | `true` for Kling 3.0 Pro |
| `status` | text | `active` | `active` / `inactive` |
| `created_at` | timestamp | now | |

### Project table change

| Column | Type | Notes |
|--------|------|-------|
| `video_model_id` | uuid FK | References `video_model.id`. Required for new projects. Backfilled to Kling 3.0 Pro for existing projects. |

### Seed data

One row: Kling 3.0 Pro with all current hardcoded values migrated from `PIPELINE_CONFIG`, `ENERGY_ARC`, and `PRODUCT_PLACEMENT_ARC`.

### Design decision: creative structure on the video model

`energy_arc`, `product_placement_arc`, and `section_names` live on the video model because they're format-dependent. A 2-segment video has a different narrative arc than a 4-segment one. The video model defines BOTH the technical parameters AND the creative structure.

---

## Pipeline Refactor

### Flow

```
Project creation → video_model_id saved on project
                → Worker fetches project + joins video_model
                → Passes video model config to each agent
                → Agents use config instead of constants
```

### Agent-by-agent changes

| Agent | What changes |
|-------|-------------|
| **ScriptingAgent** | LLM system prompt becomes dynamic. Injects `segment_count`, `segment_duration`, `shots_per_segment`, `syllables_per_segment`, `section_names` from video model instead of hardcoded "4 segments of 15s". |
| **CastingAgent** | `SEGMENTS` array derived from `segment_count` (e.g., `[0, 1, 2, 3]`). `PRODUCT_PLACEMENT_ARC` and `ENERGY_ARC` read from video model. Keyframe chaining logic unchanged. |
| **DirectorAgent** | `duration` from video model instead of hardcoded `15`. API endpoint from `api_endpoint`. `multiPrompt` shot count from `shots_per_segment`. Resolution param added to API call. |
| **VoiceoverAgent** | Audio size validation thresholds derived from `segment_duration` instead of assuming 15s. |
| **B-RollAgent** | `offset_seconds` and `duration_seconds` respect `segment_duration`. Shot count formula unchanged (syllable-based). |
| **EditorAgent** | Template slot names generated dynamically (`Video-1` through `Video-N`). Creatomate template still hardcoded for 4 slots — only changes when non-60s formats are added. |

### Worker change

When the worker fetches the project for any pipeline stage, it joins `video_model` and passes the config to the agent. Single fetch point — all agents receive the same config shape.

### Backward compatibility

`PIPELINE_CONFIG` constant kept as a fallback. If a project has no `video_model_id` (old projects pre-migration), agents use the existing constant. New projects always have a video model. The backfill migration sets `video_model_id` on all existing projects, so in practice the fallback is a safety net only.

### Resolution

The `resolution` field (`1080p`) gets passed to `WaveSpeedClient.generateVideo()`. Backend agent must verify the WaveSpeed API parameter name (likely `resolution` or via input image dimensions). If WaveSpeed infers resolution from keyframe image size, CastingAgent may need to generate higher-res keyframes.

---

## API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/video-models` | GET | New. Returns active video models for selector UI. |
| `/api/projects` | POST | Accept `video_model_id` (required; defaults to Kling 3.0 Pro `is_default` row if omitted). |
| `/api/projects/[id]` | GET | Join + return `video_model` in response. |
| `/api/projects/[id]` | PATCH | Allow changing `video_model_id` only at `created` or `analysis_review` status. |

---

## Frontend Changes

### Create project form

Video model selector added as the **first selection**, before tone/influencer. With one model today: a single pre-selected card (Kling 3.0 Pro) with model name, "60s / 4 segments / 1080p / multishot", and cost estimate (~$4.80). Lock icon + "More models coming soon" placeholder for future expansion.

### Project detail

Video model badge in project header alongside tone, influencer, etc. Shows "Kling 3.0 Pro / 1080p". Not editable once past analysis review gate.

---

## Out of Scope

- No new video formats (30s, 15s) — 60s only today
- No non-Kling models — just the abstraction layer
- No Creatomate template changes — still 4 slots
- No UI for creating custom video model profiles — system presets only

---

## Acceptance Criteria

- [ ] `video_model` table created with Kling 3.0 Pro seed row (all current constants migrated)
- [ ] `project.video_model_id` FK added, backfilled to Kling 3.0 Pro for existing projects
- [ ] All 6 agents read segment/duration/shot/arc config from video model, not `PIPELINE_CONFIG`
- [ ] `PIPELINE_CONFIG` kept as fallback for projects without `video_model_id`
- [ ] ScriptingAgent LLM prompt dynamically built from video model config
- [ ] DirectorAgent uses video model's `api_endpoint`, `segment_duration`, `resolution`
- [ ] CastingAgent uses video model's `energy_arc`, `product_placement_arc`, `segment_count`
- [ ] VoiceoverAgent adapts audio validation to `segment_duration`
- [ ] B-RollAgent timing respects `segment_duration`
- [ ] `GET /api/video-models` returns active models
- [ ] `POST /api/projects` accepts `video_model_id`
- [ ] Create project form shows video model selector (pre-selected Kling 3.0 Pro)
- [ ] Project detail shows video model badge
- [ ] 1080p resolution passed to WaveSpeed `generateVideo()` calls
- [ ] Existing projects continue working (backward compatibility via backfill + fallback)
- [ ] `npm run build` passes

## Affected Files

**New:**
- `src/app/api/video-models/route.ts` — GET endpoint

**Backend (modify):**
- `src/app/api/projects/route.ts` — POST accepts video_model_id
- `src/app/api/projects/[id]/route.ts` — GET joins video_model, PATCH allows model change at early stages
- `src/workers/pipeline.worker.ts` — Fetch video model with project, pass to agents
- `src/agents/scripting-agent.ts` — Dynamic LLM prompt from video model config
- `src/agents/casting-agent.ts` — Dynamic segments/arcs from video model
- `src/agents/director-agent.ts` — Dynamic duration/endpoint/resolution from video model
- `src/agents/voiceover-agent.ts` — Dynamic audio validation from video model
- `src/agents/broll-agent.ts` — Dynamic timing from video model
- `src/agents/editor-agent.ts` — Dynamic slot generation from video model
- `src/lib/api-clients/wavespeed.ts` — Add resolution param to generateVideo()
- `src/lib/constants.ts` — PIPELINE_CONFIG becomes fallback, add VideoModel type
- `src/db/schema.ts` — Add video_model table + project FK documentation

**Frontend (modify):**
- `src/components/create-project-form.tsx` — Video model selector card
- `src/components/project-detail.tsx` — Video model badge in header

**Migration:**
- Create `video_model` table
- Seed Kling 3.0 Pro row
- Add `video_model_id` to `project` with backfill

## PARALLEL WORK ANALYSIS

```
- Task A (migration + seed): Independent, start first
  Scope: Create video_model table, seed Kling 3.0 Pro, add project FK, backfill

- Task B (backend API + agents): Depends on Task A
  Scope: GET /api/video-models, project routes, all 6 agents, worker, wavespeed client, constants
  Files: 12 files modified

- Task C (frontend): Depends on Task A (needs video_model in API response)
  Scope: Create form selector, project detail badge
  Files: create-project-form.tsx, project-detail.tsx

Recommendation: Backend agent handles A + B (migration then agent refactor).
Frontend agent handles C after backend confirms API returns video_model.
Backend first, then frontend.
```

## Cost Impact

No additional cost. This refactor changes how config is read, not what the pipeline does. Kling 3.0 Pro cost remains ~$4.80 per video (4 segments x $1.20).
