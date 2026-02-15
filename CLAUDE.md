# TikTok Creator App

Full-stack app for producing 60-second TikTok Shop UGC videos using AI agents.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL) + `@supabase/supabase-js` client
- **Queue**: BullMQ + Upstash Redis (TLS)
- **AI**: WaveSpeed API (Gemini LLM, Nano Banana Pro images, Kling 3.0 Pro video)
- **Voice**: ElevenLabs
- **Rendering**: Creatomate

## Run Commands
- `npm run dev` -- Start Next.js dev server (localhost:3000)
- `npm run build` -- Production build
- `npm run worker` -- Start BullMQ pipeline worker (separate process)
- `npx tsx src/db/seed.ts` -- Seed database with characters + templates
- DB tables managed via Supabase MCP (no Drizzle migrations needed)

## Architecture
```
Browser -> Next.js App Router (API Routes) -> BullMQ Queue -> Worker Process
              (Vercel)                      (Upstash Redis)   (Railway)
                                                              |
                                              WaveSpeed API (LLM, images, video)
                                              Supabase (PostgreSQL via supabase-js)
```

Worker runs as a separate Node.js process, not inside Next.js.

## Deployment
- **Frontend/API**: Vercel -- https://tiktok-creator-app.vercel.app
- **Worker**: Railway -- runs `npm run worker` as persistent process
- **Database**: Supabase (project: `yuiwwmkalyplhcwgwcap`)
- **Queue**: Upstash Redis (`fast-kite-57923.upstash.io`, TLS required)

### Environment Variables (set on both Vercel + Railway)
```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY         # Supabase service role (secret)
DATABASE_URL                      # PostgreSQL connection string
WAVESPEED_API_KEY                 # WaveSpeed API
ELEVENLABS_API_KEY                # ElevenLabs TTS
CREATOMATE_API_KEY                # Creatomate video rendering
REDIS_CONNECTION_URL              # Upstash Redis (redis://...upstash.io:6379)
```

### Deploy Commands
- `npx vercel --prod` -- Deploy frontend to Vercel production
- Worker deploys via Railway dashboard (connected to GitHub, runs `npm run worker`)

### Redis TLS
Upstash requires TLS. Both `src/lib/queue.ts` and `src/workers/pipeline.worker.ts` auto-enable TLS for non-localhost Redis hosts.

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
- ~~B0.1-B0.7~~ ALL FIXED
- B0.8 CastingAgent crashes: `num_images` param wrong (pipeline blocked at casting)
- B0.9 No product image captured/validated during analysis (required before casting)
- B0.10 Failed pipeline has no recovery path (no retry, no rollback to last review gate)

**Tier 1 (NOW): Complete the Pipeline**
- R1.1 Complete Asset Generation (influencer selection gate, product interaction prompts, product image requirement, worker recovery)
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
   - R1.1 (Asset Generation) requires B0.8 (num_images fix) and B0.9 (product image) to be fixed first
   - R2.0 (Performance Tracking) requires R1.2 (Run Archive) to be built first
   - R2.1 (Hook A/B Testing) requires R2.0 (performance data to measure winners)
   - R2.2 (Trend-Aware Scripts) requires R2.0 (performance data to identify trends)
3. **New features**: If a requested feature isn't on the roadmap, flag it, determine where it fits in the tier/dependency structure, and update `docs/PRODUCT_ROADMAP.md` before implementing.
4. **Bug discoveries**: New bugs found during development get added to Tier 0 with severity and slotted above current feature work.

## Git Rule
**Always push to GitHub after committing.** Every commit should be followed by `git push`. This applies to bug fixes, feature completions, and roadmap/doc updates. Do not let local commits accumulate unpushed.

## Frontend Design Rule
**ALL frontend changes MUST use the `frontend-designer` skill.** Any work touching `.tsx` files, pages, components, or styling must invoke `/frontend-designer` first. This applies to both direct work and subagent-dispatched work. The skill is at `.claude/skills/frontend-designer/SKILL.md`.

## Backend Development Rule
**ALL backend changes MUST use the `backend-developer` skill.** Any work touching API routes (`.ts` in `app/api/`), agents (`src/agents/`), workers (`src/workers/`), lib (`src/lib/`), db (`src/db/`), middleware (`src/middleware.ts`), or Supabase migrations must invoke the `backend-developer` skill first. This applies to both direct work and subagent-dispatched work. The skill enforces the superpowers workflow: brainstorm → plan → execute → verify. The skill is at `.claude/skills/backend-developer/SKILL.md`.

## Predecessor
This app replaces the n8n-based orchestration at `../tt_shop_content_creator/`.
