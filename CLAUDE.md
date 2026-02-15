# TikTok Creator App

Full-stack app for producing 60-second TikTok Shop UGC videos using AI agents.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL) + `@supabase/supabase-js` client
- **Queue**: BullMQ + Redis
- **AI**: WaveSpeed API (Gemini LLM, Nano Banana Pro images, Kling 3.0 Pro video)
- **Voice**: ElevenLabs (future phases)
- **Rendering**: Creatomate (future phases)

## Run Commands
- `npm run dev` -- Start Next.js dev server (localhost:3000)
- `npm run build` -- Production build
- `npm run worker` -- Start BullMQ pipeline worker (separate process)
- `npx tsx src/db/seed.ts` -- Seed database with characters + templates
- DB tables managed via Supabase MCP (no Drizzle migrations needed)

## Architecture
```
Browser -> Next.js App Router (API Routes) -> BullMQ Queue -> Worker Process
                                                              |
                                              WaveSpeed API (LLM, images, video)
                                              Supabase (PostgreSQL via supabase-js)
```

Worker runs as a separate Node.js process, not inside Next.js.

## Database Tables
- `ai_character` -- Persona library (11 characters)
- `script_template` -- Hook patterns (10 templates)
- `project` -- Run metadata and status tracking
- `script` -- Generated scripts with grading
- `scene` -- Individual 15s segments
- `asset` -- Generated artifacts (images, video, audio)

## API Routes
- `GET /api/projects` -- List all projects
- `POST /api/projects` -- Create project + enqueue analysis
- `GET /api/projects/[id]` -- Project detail with relations
- `PATCH /api/projects/[id]` -- Update project
- `GET /api/queue/status?projectId=xxx` -- Job status polling
- `GET /api/characters` -- List AI characters

## Agent Pipeline
1. **ProductAnalyzerAgent** -- Analyzes product URL, extracts structured data, maps avatar
2. **ScriptingAgent** -- 4-segment script generation with syllable validation, hook scoring, tone presets
3. CastingAgent (Phase 3) -- Keyframe image generation
4. DirectorAgent (Phase 3) -- Video generation
5. VoiceoverAgent (Phase 3) -- TTS audio generation
6. EditorAgent (Phase 4) -- Video composition

## Product Roadmap
Full roadmap at `docs/PRODUCT_ROADMAP.md`. Current priority order:

**Tier 0 (FIRST): Critical Bugs**
- B0.1 Asset grading endpoint missing (feature broken)
- B0.2 Influencer deletion FK integrity
- B0.3 Pipeline status guards on deletion
- B0.4 Influencer edit capability (no PATCH)
- B0.5 Stale project list after creation
- B0.6 Cost tracking on regeneration
- B0.7 Schema documentation drift

**Tier 1 (NOW): Complete the Pipeline**
- R1.1 Complete Asset Generation (finish Phase 3, worker recovery, cost confirmations)
- R1.2 Video Composition + Run Archive (Phase 4 - EditorAgent, handle `editing` status)
- R1.3 Reference Video Intelligence (make `video_url` input functional)

**Tier 1.5 (POLISH): UX Hardening**
- R1.5.1 Influencer management completion (edit, image re-upload)
- R1.5.2 Project settings editing (change tone/character at review gates)
- R1.5.3 Navigation & state consistency (pagination, search, back links)
- R1.5.4 Error handling & recovery (error boundaries, retry, offline)

**Tier 2 (NEXT): Make It Convert**
- R2.0 Performance Tracking & KPI Dashboard (TikTok engagement + revenue per run)
- R2.1 Hook A/B Testing (depends on R2.0)
- R2.2 Trend-Aware Script Generation (depends on R2.0)
- R2.3 Avatar Consistency & Brand Kit
- R2.4 Product Image Integration

**Tier 3 (THEN): Scale** -- Batch generation, script library, cost optimization
**Tier 4 (LATER): Growth** -- Auth, TikTok publishing, multi-platform, marketplace

## Feature Prioritization Rule
**Before building any new feature, check `docs/PRODUCT_ROADMAP.md`.** Enforce these rules:
1. **Tier ordering**: Do not start work from a lower tier while higher-tier items remain incomplete. Tier 0 bugs ALWAYS come first.
2. **Dependency chain**: Check the `Depends on:` field on each roadmap item. Never build a feature before its dependencies are complete. Key dependencies:
   - R1.1 (Asset Generation) requires B0.1 (asset grading endpoint) to be fixed first
   - R2.0 (Performance Tracking) requires R1.2 (Run Archive) to be built first
   - R2.1 (Hook A/B Testing) requires R2.0 (performance data to measure winners)
   - R2.2 (Trend-Aware Scripts) requires R2.0 (performance data to identify trends)
3. **New features**: If a requested feature isn't on the roadmap, flag it, determine where it fits in the tier/dependency structure, and update `docs/PRODUCT_ROADMAP.md` before implementing.
4. **Bug discoveries**: New bugs found during development get added to Tier 0 with severity and slotted above current feature work.

## Git Rule
**Always push to GitHub after committing.** Every commit should be followed by `git push`. This applies to bug fixes, feature completions, and roadmap/doc updates. Do not let local commits accumulate unpushed.

## Frontend Design Rule
**ALL frontend changes MUST use the `frontend-designer` skill.** Any work touching `.tsx` files, pages, components, or styling must invoke `/frontend-designer` first. This applies to both direct work and subagent-dispatched work. The skill is at `.claude/skills/frontend-designer/SKILL.md`.

## Predecessor
This app replaces the n8n-based orchestration at `../tt_shop_content_creator/`.
