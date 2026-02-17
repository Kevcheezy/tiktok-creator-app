# MONEY PRINTER 3000

Full-stack app for producing 60-second TikTok Shop UGC videos using AI agents.

## Build & Verify
Always run the build command (`npm run build`) after making code changes and before committing. Never commit code that doesn't pass the build step. If a type error or build failure occurs, fix it before proceeding.

## Agent Role Requirement

**Every Claude Code instance MUST operate under a declared role.** The user's first message must specify which role this agent is. If no role is stated, **ASK before doing anything else.**

| Role | Scope | Required Skill | Cannot Touch |
|------|-------|---------------|--------------|
| `frontend` | `.tsx` files, pages, components, styling, `globals.css` | `frontend-designer` | API routes, agents, workers, lib, db, middleware |
| `backend` | API routes, agents, workers, lib, db, middleware, Supabase migrations | `backend-developer`, `backend-debugger` | `.tsx` files, components, pages, styling |
| `product-manager` | Roadmap, CLAUDE.md priorities, design docs, specs | `product-manager` | Any source code files |
| `other` | Config, CI/CD, docs, tooling, `package.json`, git ops | General superpowers | Files scoped to frontend or backend roles |

**Rules:**
1. **Role is locked for the entire session.** Once declared, do not cross role boundaries.
2. **If work outside your scope is needed**, flag it and suggest the user spawn a separate agent for that domain.
3. **Invoke your role's required skill** before starting any work.
4. **Mark roadmap items in progress BEFORE writing any code.** When starting a task, update `docs/ENGINEERING_ROADMAP.md` with `🔧 IN PROGRESS` on the item immediately — before any implementation begins. This is non-negotiable for all roles.
5. **Mark roadmap items DONE when finished.** After implementation is complete and verified, update `docs/ENGINEERING_ROADMAP.md` — change status to `~~DONE~~`/`~~FIXED~~`, check off completed sub-items `[x]`, and ensure the roadmap accurately reflects what was built. The roadmap MUST stay aligned with the actual architecture and implementation at all times — no drift between what the roadmap says and what the code does.

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
**`docs/ENGINEERING_ROADMAP.md` is the single source of truth for all roadmap content.** CLAUDE.md must NEVER contain roadmap items, tier listings, completion status, or dependency chains. All progress updates go in ENGINEERING_ROADMAP.md only.

## Feature Prioritization Rule
**Before building any new feature, check `docs/ENGINEERING_ROADMAP.md`.** Enforce these rules:
1. **Tier ordering**: Do not start work from a lower tier while higher-tier items remain incomplete. Tier 0 bugs ALWAYS come first.
2. **Dependency chain**: Check the `Depends on:` field on each roadmap item. Never build a feature before its dependencies are complete.
3. **New features**: If a requested feature isn't on the roadmap, flag it, determine where it fits in the tier/dependency structure, and update `docs/ENGINEERING_ROADMAP.md` before implementing.
4. **Bug discoveries**: New bugs found during development get added to Tier 0 with severity and slotted above current feature work.
5. **Progress tracking**: When picking up a roadmap item, mark it `🔧 IN PROGRESS` in `docs/ENGINEERING_ROADMAP.md` before writing any code. When completed, update to `~~DONE~~` / `~~FIXED~~`. Never update CLAUDE.md with progress — roadmap file only.

## API Research
When researching external APIs or services, ask the user for their preferred documentation source FIRST before web-fetching from multiple generic sources. Use project-specific docs (e.g., Higgsfield docs, specific API references) over general web searches.

## Multi-Message Inputs
When a user's message references a file, document, or content they plan to paste, wait for the follow-up message before proceeding. Do not ask them to provide what they've already indicated they will paste next.

## TypeScript Conventions
This project uses TypeScript. When editing types:
- Ensure const assertions and literal types are compatible with wider config interfaces
- Run `tsc --noEmit` or the project build after any type changes
- Prefer widening types at the declaration site rather than using `as` casts

## Git Rule
**Always push to GitHub after committing.** Every commit should be followed by `git push`. This applies to bug fixes, feature completions, and roadmap/doc updates. Do not let local commits accumulate unpushed.

## Frontend Design Rule
**ALL frontend changes MUST use the `frontend-designer` skill.** Any work touching `.tsx` files, pages, components, or styling must invoke `/frontend-designer` first. This applies to both direct work and subagent-dispatched work. The skill is at `.claude/skills/frontend-designer/SKILL.md`.

## Backend Development Rule
**ALL backend changes MUST use the `backend-developer` skill.** Any work touching API routes (`.ts` in `app/api/`), agents (`src/agents/`), workers (`src/workers/`), lib (`src/lib/`), db (`src/db/`), middleware (`src/middleware.ts`), or Supabase migrations must invoke the `backend-developer` skill first. This applies to both direct work and subagent-dispatched work. The skill enforces the superpowers workflow: brainstorm → plan → execute → verify. The skill is at `.claude/skills/backend-developer/SKILL.md`.

## Debugger Rule
**When the user asks to investigate, debug, or diagnose a failure, the backend agent invokes the `backend-debugger` skill.** Trigger words: "investigate", "debug", "diagnose", "what went wrong", "why did it fail", "check the logs", "look into this failure". The skill wraps `superpowers:systematic-debugging` with app-specific triage queries, an observability toolkit, and known failure patterns. The backend agent can both diagnose AND fix. The skill is at `.claude/skills/debugger/SKILL.md`.

## Predecessor
This app replaces the n8n-based orchestration at `../tt_shop_content_creator/`.
