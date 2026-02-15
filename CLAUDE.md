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
2. ScriptingAgent (Phase 2)
3. CastingAgent (Phase 3)
4. DirectorAgent (Phase 3)
5. EditorAgent (Phase 4)

## Frontend Design Rule
**ALL frontend changes MUST use the `frontend-designer` skill.** Any work touching `.tsx` files, pages, components, or styling must invoke `/frontend-designer` first. This applies to both direct work and subagent-dispatched work. The skill is at `.claude/skills/frontend-designer/SKILL.md`.

## Predecessor
This app replaces the n8n-based orchestration at `../tt_shop_content_creator/`.
