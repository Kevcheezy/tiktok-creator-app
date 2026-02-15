# TikTok Creator App

Full-stack app for producing 60-second TikTok Shop UGC videos using AI agents. Give it a product URL and an AI character, and the pipeline generates scripts, images, voiceovers, and a final composed video.

## Architecture

```
Browser ──> Next.js App Router (API Routes) ──> BullMQ Queue ──> Worker Process
                   (Vercel)                    (Upstash Redis)      (Railway)
                                                                       │
                                                         ┌─────────────┼─────────────┐
                                                         │             │             │
                                                    WaveSpeed     ElevenLabs   Creatomate
                                                  (LLM, images,    (TTS)     (video render)
                                                     video)
                                                         │
                                                      Supabase
                                                    (PostgreSQL)
```

The worker runs as a **separate Node.js process** on Railway, not inside Next.js.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) + `@supabase/supabase-js` |
| Queue | BullMQ + Upstash Redis (TLS) |
| AI / LLM | WaveSpeed API (Gemini LLM, Nano Banana Pro images, Kling 3.0 Pro video) |
| Voice | ElevenLabs TTS |
| Video Rendering | Creatomate |
| Validation | Zod |
| Auth | Supabase Auth (OAuth) |

## Agent Pipeline

The app uses a multi-stage AI pipeline with human-in-the-loop review gates:

| Phase | Agent | Status | Description |
|-------|-------|--------|-------------|
| 1 | **ProductAnalyzerAgent** | Active | Analyzes product URL, extracts structured data, captures product image |
| 2 | **ScriptingAgent** | Active | 4-segment script generation with syllable validation, hook scoring, tone presets |
| 3 | **CastingAgent** | Active | Keyframe image generation (2 images per scene) |
| 3 | **DirectorAgent** | In Progress | Video generation via Kling 3.0 Pro |
| 3 | **VoiceoverAgent** | In Progress | TTS audio generation via ElevenLabs |
| 4 | **EditorAgent** | Planned | Final video composition via Creatomate |

**Status lifecycle:** `created → analyzing → scripting → casting → directing → editing → completed | failed`

## Project Structure

```
src/
├── agents/                    # AI pipeline agents
│   ├── base-agent.ts          # Base class for all agents
│   ├── product-analyzer.ts    # Phase 1: Product analysis
│   ├── scripting-agent.ts     # Phase 2: Script generation
│   ├── casting-agent.ts       # Phase 3: Image generation
│   ├── director-agent.ts      # Phase 3: Video generation
│   ├── voiceover-agent.ts     # Phase 3: TTS audio
│   └── editor-agent.ts        # Phase 4: Video composition
│
├── app/
│   ├── api/                   # API route handlers
│   │   ├── projects/          # CRUD + pipeline operations
│   │   ├── influencers/       # Influencer management
│   │   ├── characters/        # AI character listing
│   │   └── queue/status/      # Job status polling
│   ├── auth/                  # OAuth callback + signout
│   ├── projects/              # Project pages (list, detail, create)
│   ├── influencers/           # Influencer pages (list, detail, create)
│   ├── login/                 # Login page
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Dashboard
│
├── components/                # React components
│   ├── nav.tsx                # Top navigation
│   ├── project-list.tsx       # Project grid
│   ├── project-card.tsx       # Project summary card
│   ├── project-detail.tsx     # Full project view
│   ├── create-project-form.tsx# New project form
│   ├── script-review.tsx      # Script review interface
│   ├── segment-card.tsx       # Individual segment display
│   ├── asset-review.tsx       # Asset review interface
│   ├── asset-card.tsx         # Individual asset display
│   ├── approve-controls.tsx   # Pipeline approval controls
│   ├── pipeline-progress.tsx  # Pipeline stage indicator
│   ├── status-badge.tsx       # Status indicator
│   ├── tone-selector.tsx      # Tone preset picker
│   ├── script-upload.tsx      # Manual script upload
│   ├── confirm-dialog.tsx     # Confirmation modal
│   ├── influencer-list.tsx    # Influencer grid
│   ├── influencer-detail.tsx  # Influencer detail view
│   └── influencer-form.tsx    # Influencer create/edit form
│
├── db/                        # Database layer
│   ├── schema.ts              # Drizzle schema definitions
│   ├── index.ts               # Database connection
│   └── seed.ts                # Character + template seed data
│
├── lib/                       # Shared utilities
│   ├── api-clients/           # External API wrappers
│   │   ├── wavespeed.ts       # WaveSpeed (LLM, images, video)
│   │   ├── elevenlabs.ts      # ElevenLabs TTS
│   │   └── creatomate.ts      # Creatomate video rendering
│   ├── supabase/              # Supabase client setup
│   │   ├── client.ts          # Browser client
│   │   └── server.ts          # Server client
│   ├── queue.ts               # BullMQ queue config
│   ├── constants.ts           # Shared constants
│   └── syllables.ts           # Syllable counting for scripts
│
├── workers/
│   └── pipeline.worker.ts     # BullMQ worker (runs on Railway)
│
└── middleware.ts               # Auth + request middleware
```

## Database Schema

Six tables in Supabase (PostgreSQL):

| Table | Description |
|-------|-------------|
| `ai_character` | 11 AI personas with voice, appearance, wardrobe, settings |
| `script_template` | 10 hook patterns with energy arcs and scoring |
| `project` | Pipeline run metadata, status tracking, cost accumulation |
| `script` | Generated scripts with hook scores and grading |
| `scene` | 4 segments per script (15s each) with visual/audio prompts |
| `asset` | Generated artifacts (images, video, audio) with cost tracking |

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project + enqueue analysis |
| GET | `/api/projects/[id]` | Project detail with relations |
| PATCH | `/api/projects/[id]` | Update project |
| POST | `/api/projects/[id]/approve` | Approve pipeline stage |
| POST | `/api/projects/[id]/archive` | Archive project |
| GET | `/api/projects/[id]/assets` | List project assets |
| POST | `/api/projects/[id]/product-image` | Upload product image |
| GET | `/api/projects/[id]/scripts` | List scripts |
| POST | `/api/projects/[id]/scripts` | Create script |
| POST | `/api/projects/[id]/scripts/upload` | Upload manual script |
| GET | `/api/projects/[id]/scripts/[scriptId]` | Get script detail |
| PATCH | `/api/projects/[id]/scripts/[scriptId]` | Update script |
| POST | `/api/projects/[id]/scripts/[scriptId]/regenerate` | Regenerate script |
| PATCH | `/api/projects/[id]/scripts/[scriptId]/segments/[idx]` | Update segment |
| POST | `/api/projects/[id]/scripts/[scriptId]/segments/[idx]/regenerate` | Regenerate segment |
| GET | `/api/queue/status` | Job status polling |
| GET | `/api/influencers` | List influencers |
| POST | `/api/influencers` | Create influencer |
| GET | `/api/influencers/[id]` | Get influencer detail |
| PATCH | `/api/influencers/[id]` | Update influencer |
| DELETE | `/api/influencers/[id]` | Delete influencer |
| GET | `/api/characters` | List AI characters |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- Upstash Redis instance
- API keys for WaveSpeed, ElevenLabs, and Creatomate

### Environment Variables

Create a `.env.local` file (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (secret)
DATABASE_URL=                     # PostgreSQL connection string
WAVESPEED_API_KEY=                # WaveSpeed API
ELEVENLABS_API_KEY=               # ElevenLabs TTS
CREATOMATE_API_KEY=               # Creatomate video rendering
REDIS_CONNECTION_URL=             # Upstash Redis (redis://...upstash.io:6379)
```

### Run Locally

```bash
# Install dependencies
npm install

# Seed the database with AI characters and script templates
npx tsx src/db/seed.ts

# Start the Next.js dev server
npm run dev

# In a separate terminal, start the pipeline worker
npm run worker
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Deployment

| Service | Platform | Command |
|---------|----------|---------|
| Frontend + API | Vercel | `npx vercel --prod` |
| Pipeline Worker | Railway | Auto-deploys via GitHub (`npm run worker`) |
| Database | Supabase | Managed |
| Queue | Upstash Redis | Managed (TLS required) |

Both the queue config and pipeline worker auto-enable TLS for non-localhost Redis hosts.

## Development Workflow

This project uses a role-based agent system for AI-assisted development. See `CLAUDE.md` for full details.

| Agent Role | Skill | Responsibility |
|------------|-------|---------------|
| `frontend` | `frontend-designer` | All `.tsx`, pages, components, styling |
| `backend` | `backend-developer` | API routes, agents, workers, lib, db, middleware |
| `product-manager` | `product-manager` | Roadmap, specs, prioritization, parallel work identification |
| `other` | General | Config, CI/CD, docs, tooling |
