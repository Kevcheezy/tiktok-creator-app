# TikTok Creator App

Full-stack app for producing 60-second TikTok Shop UGC videos using AI agents.

## Agent Role Requirement

**Every Claude Code instance MUST operate under a declared role.** The user's first message must specify which role this agent is. If no role is stated, **ASK before doing anything else.**

| Role | Scope | Required Skill | Cannot Touch |
|------|-------|---------------|--------------|
| `frontend` | `.tsx` files, pages, components, styling, `globals.css` | `frontend-designer` | API routes, agents, workers, lib, db, middleware |
| `backend` | API routes, agents, workers, lib, db, middleware, Supabase migrations | `backend-developer` | `.tsx` files, components, pages, styling |
| `product-manager` | Roadmap, CLAUDE.md priorities, design docs, specs | `product-manager` | Any source code files |
| `debugger` | Read-only investigation: SQL queries (SELECT only), source code reading, log analysis | `debugger` | Any code/data modifications — diagnosis and proposals only |
| `other` | Config, CI/CD, docs, tooling, `package.json`, git ops | General superpowers | Files scoped to frontend or backend roles |

**Rules:**
1. **Role is locked for the entire session.** Once declared, do not cross role boundaries.
2. **If work outside your scope is needed**, flag it and suggest the user spawn a separate agent for that domain.
3. **Invoke your role's required skill** before starting any work.

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
- **Auto-deploy**: Push to `main` → Vercel + Railway both deploy automatically
- `npx vercel --prod` -- Manual deploy fallback (rarely needed)

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

## Roadmap Rule
**`docs/PRODUCT_ROADMAP.md` is the single source of truth for all roadmap content.** CLAUDE.md must NEVER contain roadmap items, tier listings, completion status, or dependency chains. All progress updates go in PRODUCT_ROADMAP.md only.

## Feature Prioritization Rule
**Before building any new feature, check `docs/PRODUCT_ROADMAP.md`.** Enforce these rules:
1. **Tier ordering**: Do not start work from a lower tier while higher-tier items remain incomplete. Tier 0 bugs ALWAYS come first.
2. **Dependency chain**: Check the `Depends on:` field on each roadmap item. Never build a feature before its dependencies are complete.
3. **New features**: If a requested feature isn't on the roadmap, flag it, determine where it fits in the tier/dependency structure, and update `docs/PRODUCT_ROADMAP.md` before implementing.
4. **Bug discoveries**: New bugs found during development get added to Tier 0 with severity and slotted above current feature work.
5. **Progress updates**: When a roadmap item is completed, update `docs/PRODUCT_ROADMAP.md` — never CLAUDE.md.

## Git Rule
**Always push to GitHub after committing.** Every commit should be followed by `git push`. This applies to bug fixes, feature completions, and roadmap/doc updates. Do not let local commits accumulate unpushed.

## Frontend Design Rule
**ALL frontend changes MUST use the `frontend-designer` skill.** Any work touching `.tsx` files, pages, components, or styling must invoke `/frontend-designer` first. This applies to both direct work and subagent-dispatched work. The skill is at `.claude/skills/frontend-designer/SKILL.md`.

## Backend Development Rule
**ALL backend changes MUST use the `backend-developer` skill.** Any work touching API routes (`.ts` in `app/api/`), agents (`src/agents/`), workers (`src/workers/`), lib (`src/lib/`), db (`src/db/`), middleware (`src/middleware.ts`), or Supabase migrations must invoke the `backend-developer` skill first. This applies to both direct work and subagent-dispatched work. The skill enforces the superpowers workflow: brainstorm → plan → execute → verify. The skill is at `.claude/skills/backend-developer/SKILL.md`.

## Debugger Rule
**When the user asks to investigate, debug, or diagnose a pipeline failure, invoke the `debugger` skill.** Trigger words: "investigate", "debug", "diagnose", "what went wrong", "why did it fail", "check the logs", "look into this failure". The debugger skill is read-only — it queries `generation_log`, `project`, `asset`, `script`, and `scene` tables (SELECT only) and reads source code to produce a diagnosis report. It never modifies code or data. The skill is at `.claude/skills/debugger/SKILL.md`.

## Predecessor
This app replaces the n8n-based orchestration at `../tt_shop_content_creator/`.
