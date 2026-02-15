# Phase 2 Design: ScriptingAgent + Frontend Overhaul

## Overview
Phase 2 adds the ScriptingAgent (pipeline stage 2) and completely redesigns the frontend using the frontend-designer agent. The existing Phase 1 UI is generic scaffolding — it gets replaced with a distinctive, production-grade design.

## Part A: ScriptingAgent Backend

### ScriptingAgent (`src/agents/scripting-agent.ts`)
- Input: completed product analysis from `project.product_data`
- LLM call: WaveSpeed Any-LLM (Gemini 2.5 Flash) with structured system prompt
- Output per segment (4 total):
  - `script_text`: spoken words (82-90 syllables)
  - `shot_scripts`: 3 x 5s chunks with text split
  - `audio_sync`: 3 sync points (word, time, shot, action, energy)
  - `text_overlay`: on-screen text
  - `energy_arc`: {start, middle, end} energy levels
  - `section`: Hook | Problem | Solution + Product | CTA
- Post-processing: syllable validation, hook score check, energy arc validation
- Optional: uses matching `script_template` for hook pattern
- Saves: 1 `script` row + 4 `scene` rows

### Worker step
- Add `scripting` handler to `pipeline.worker.ts`
- Sets status `scripting` → runs agent → sets status `script_review` or `failed`

### API routes
- `POST /api/projects/[id]/approve` — Approve current stage, enqueue next pipeline step
- `GET /api/projects/[id]/scripts` — List script versions
- `PATCH /api/projects/[id]/scripts/[scriptId]` — Grade + feedback
- `POST /api/projects/[id]/scripts/[scriptId]/regenerate` — Re-run with feedback

### Status lifecycle update
Add `script_review` state: `created → analyzing → analysis_review → scripting → script_review → casting → ...`
Also add `analysis_review` for the Phase 1 human review pause point.

## Part B: Frontend Overhaul

The frontend-designer agent critically reviews and redesigns ALL existing pages:

### Pages to redesign
1. **Dashboard** (`src/app/page.tsx`) — Project list with status, progress indicators
2. **Create Project** (`src/app/projects/new/page.tsx`) — Product URL input form
3. **Project Detail** (`src/app/projects/[id]/page.tsx`) — Multi-stage project view

### New pages to build
4. **Script Review** — Shows generated script (4 segments), grade controls, approve/regenerate

### Components to redesign/create
- `nav.tsx` — Navigation with app identity
- `status-badge.tsx` — Pipeline stage indicator (redesign)
- `project-card.tsx` — Project summary (redesign)
- `project-list.tsx` — Grid layout (redesign)
- `project-detail.tsx` — Full project view (redesign)
- `create-project-form.tsx` — URL input (redesign)
- NEW: `pipeline-progress.tsx` — Multi-stage progress indicator
- NEW: `script-review.tsx` — Script segment display with grading
- NEW: `segment-card.tsx` — Individual segment display (text, syllables, energy)
- NEW: `approve-controls.tsx` — Approve/regenerate/grade controls

### Design requirements
- The frontend-designer agent must critique the existing implementation first
- Propose a bold aesthetic direction appropriate for a content creation / video production tool
- Apply consistently across all pages
- No UI libraries — raw Tailwind v4 only

## Parallel Agent Strategy

### Agent A: ScriptingAgent Backend
- `src/agents/scripting-agent.ts`
- `src/workers/pipeline.worker.ts` (add scripting handler)
- `src/app/api/projects/[id]/approve/route.ts`
- `src/app/api/projects/[id]/scripts/route.ts`
- `src/app/api/projects/[id]/scripts/[scriptId]/route.ts`
- `src/app/api/projects/[id]/scripts/[scriptId]/regenerate/route.ts`
- DB migration: add `script_review` and `analysis_review` statuses

### Agent B: Frontend Overhaul (uses frontend-designer skill)
- All components in `src/components/`
- All pages in `src/app/`
- `src/app/globals.css` (design tokens)
- `src/app/layout.tsx` (fonts, theme)

### Agent C: Integration + Verification
- Wire approve flow: analysis_review → scripting → script_review
- End-to-end test: create project → analyze → approve → script → review → grade
- `npm run build` passes
