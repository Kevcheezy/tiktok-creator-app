# Tier 1 MVP Completion — Design

## Goal

Ship a working end-to-end pipeline: product URL in, finished 60-second video out. This completes R1.1 (Asset Generation) and R1.2 (Video Composition + Run Archive) from the product roadmap.

## Scope

1. **Production mode** — Process all 4 segments (remove TEST_SEGMENTS restriction)
2. **DirectorAgent retry** — Retry failed video generation (max 2 retries, continue on failure)
3. **Creatomate integration** — API client for video rendering
4. **EditorAgent** — Stitch 4 video segments + voiceover audio into one 60s video via Creatomate
5. **Final review UI** — Video player, download button, recipe summary in project detail page
6. **Run archive** — Snapshot completed runs as immutable records

## Architecture

```
Asset Review (approve) → Pipeline Worker (editing stage)
  → EditorAgent
    → Fetch video + audio assets (4 each)
    → Map to Creatomate template slots
    → Creatomate API: render composed video
    → Poll until complete
    → Store final_video asset
  → Status → completed
  → Final Review UI (player, download, archive button)
  → Archive Run (snapshot recipe + metrics to completed_run table)
```

## Production Mode

Change `TEST_SEGMENTS = [0]` → `[0,1,2,3]` in:
- `src/agents/casting-agent.ts`
- `src/agents/director-agent.ts`
- `src/agents/voiceover-agent.ts`

## DirectorAgent Retry

Wrap video generation + poll in a retry loop:
- Max 2 retries with 10s delay between attempts
- On all retries exhausted: mark asset as `failed`, continue with remaining segments
- Don't crash the entire project for one failed segment

## Creatomate Client

New file: `src/lib/api-clients/creatomate.ts`
- `renderVideo(options)` — POST to Creatomate render API
- `pollRender(renderId)` — Poll render status, return final video URL
- Uses `CREATOMATE_API_KEY` env var
- Template ID from `CREATOMATE_TEMPLATE_ID` constant

## EditorAgent

New file: `src/agents/editor-agent.ts`
- Fetches all completed video + audio assets (4 segments each)
- Maps to Creatomate template: video_1..video_4 slots, audio_1..audio_4 tracks
- Calls Creatomate render API
- Polls until complete
- Creates `final_video` asset with resulting URL
- Tracks render cost

## Pipeline Worker Update

Add `editing` handler in `src/workers/pipeline.worker.ts`:
- Triggered after `asset_review` approval
- Runs `EditorAgent.run(projectId)`
- Transitions status to `completed`

## Final Review UI

Rendered in `project-detail.tsx` when status is `completed`:
- Video player for the final 60s composed video
- Download button (direct link)
- Recipe summary: product name, tone, character/influencer, hook score, total cost
- "Archive Run" button

## Run Archive

### Database: `completed_run` table
- `id` uuid PK
- `project_id` uuid FK → project
- `product_data` jsonb (name, URL, category)
- `script_snapshot` jsonb (full script text + segments)
- `tone` text
- `character_name` text
- `influencer_name` text
- `hook_score` integer
- `asset_urls` jsonb (all asset URLs by type)
- `final_video_url` text
- `total_cost_usd` numeric(10,4)
- `created_at` timestamptz

### API: `POST /api/projects/[id]/archive`
- Gathers project recipe data + all asset URLs
- Inserts into `completed_run`
- Returns the archived record

## Composition: Stitch + Audio Only

MVP composition is minimal:
- Concatenate 4 video segments (15s each) into 60s
- Overlay voiceover audio tracks on corresponding segments
- No text overlays (deferred)
- No transition effects (deferred)

## No Changes To

- `src/db/index.ts` — service role client unchanged
- Authentication — middleware gate stays as-is
- Existing review gates (analysis, script, casting, asset)
