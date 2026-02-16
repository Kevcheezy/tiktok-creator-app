# Projects Tab — FF7 World Map Quest Board

**Date:** 2026-02-15
**Status:** APPROVED
**Priority:** P1 - High (Tier 1.5)
**Effort:** Medium-Large

---

## Problem Statement

The Projects tab is a flat grid of cards with status filter pills. It shows projects as a list — functional but gives no spatial sense of where each project is in the pipeline. Users can't see at a glance which projects need attention, which are progressing, and which have reached the finish line. The tab doesn't leverage the FF7 theme to make pipeline progression feel like an interactive quest.

## Solution

Replace the flat project grid with an FF7 World Map Kanban board. The 17 pipeline statuses group into 6 quest locations (Midgar → Kalm → Cosmo Canyon → Junon → Gold Saucer → Northern Crater). Projects are quest encounter cards that travel the map left-to-right. Review gates are "boss encounters" where the user must act. Rich interactive cards show quick actions directly on the board.

**Hard constraints:**
- Zero backend/API changes — same data fetch, new layout
- Project detail page unchanged — cards link to it
- Pipeline logic unchanged — no status or workflow modifications
- Existing `project-list.tsx` kept as fallback (not deleted)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Kanban axis | Pipeline phases as columns | Projects flow left-to-right through the pipeline. Each column = one quest location. |
| Quest metaphor | FF7 World Map quest line | Horizontal path through iconic locations: Midgar → Kalm → Cosmo Canyon → Junon → Gold Saucer → Northern Crater |
| Card interactivity | Rich interactive cards | Quick-action buttons at review gates, ATB progress bar, character sprites, Gil cost. Navigate to detail page for full review. |
| Failed projects | Stay in failure column with KO overlay | They "fell in battle" at that location. Retry/rollback buttons on card. |

---

## World Map Column Mapping

| Column | FF7 Location | Pipeline Statuses | Character | Theme |
|--------|-------------|-------------------|-----------|-------|
| **Midgar** | Sector 7 Slums | `created`, `analyzing`, `analysis_review` | Cloud | "Reconnaissance" — Product analysis & first review |
| **Kalm** | Kalm Inn | `scripting`, `script_review` | Tifa | "The Plan" — Script generation & story review |
| **Cosmo Canyon** | Observatory | `broll_planning`, `broll_review` | Aerith | "Vision Quest" — B-roll planning & storyboard review |
| **Junon** | Military Port | `influencer_selection`, `casting`, `casting_review` | Red XIII | "Recruitment" — Influencer pick, keyframe generation |
| **Gold Saucer** | Event Square | `directing`, `voiceover`, `broll_generation`, `asset_review` | Barret + Cait Sith | "The Show" — Video, voice, B-roll generation + final asset review |
| **Northern Crater** | Victory Throne | `editing`, `completed` | All (Limit Break) | "Final Assault" — Composition + victory |

### Status → Column Mapping (Exhaustive)

```typescript
const STATUS_COLUMN_MAP: Record<string, string> = {
  created: 'midgar',
  analyzing: 'midgar',
  analysis_review: 'midgar',
  scripting: 'kalm',
  script_review: 'kalm',
  broll_planning: 'cosmo_canyon',
  broll_review: 'cosmo_canyon',
  influencer_selection: 'junon',
  casting: 'junon',
  casting_review: 'junon',
  directing: 'gold_saucer',
  voiceover: 'gold_saucer',
  broll_generation: 'gold_saucer',
  asset_review: 'gold_saucer',
  editing: 'northern_crater',
  completed: 'northern_crater',
  failed: '<column where it failed>' // uses failed_at_status to determine
};
```

Failed projects use `failed_at_status` to determine which column they belong to. A project that failed during `directing` stays in the Gold Saucer column with a KO overlay.

---

## Board Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PROJECTS                                    [Search 🔍]    [▶ New Quest]        │
│                                                                                  │
│  ⚔️ 3 In Battle   ▶ 4 Awaiting Orders   ⭐ 12 Victories   💀 1 KO   💰 67 Gil │
│                                                                                  │
│  ── terrain gradient (city → fields → canyon → ocean → desert → ice) ──         │
│                                                                                  │
│  🏙️ MIDGAR ────── 🏠 KALM ────── 🔥 COSMO ────── ⚓ JUNON ────── 🎡 GOLD ────── ❄️ CRATER │
│  ☁️ Recon (2)      👊 Plan (1)    🌸 Vision (0)   🔥 Recruit (3)  💪 Show (1)    ⭐ Final (5) │
│                                                                                  │
│  ┌──────────┐     ┌──────────┐                    ┌──────────┐    ┌──────────┐  ┌──────────┐ │
│  │▶ YOUR    │     │👊 Serum  │                    │🔥 Bands  │    │💪 Vita   │  │⭐ Hair   │ │
│  │  TURN    │     │  Script  │                    │▶ YOUR    │    │  Direct  │  │ VICTORY  │ │
│  │──────────│     │──────────│                    │  TURN    │    │──────────│  │──────────│ │
│  │Vitamin C │     │████░░ 60%│                    │──────────│    │██████ 85%│  │████ 100% │ │
│  │Gil: 0.02 │     │Gil: 0.02 │                    │Res.Bands │    │Gil: 5.38 │  │Gil: 5.58 │ │
│  │[Review]  │     │          │                    │Gil: 0.56 │    │          │  │[View]    │ │
│  └──────────┘     └──────────┘                    │[Review]  │    └──────────┘  └──────────┘ │
│                                                    └──────────┘                               │
│  ┌──────────┐                                     ┌──────────┐                  ┌──────────┐ │
│  │☁️ Protein│                                     │🔥 Glow   │                  │💀 KO     │ │
│  │  Scan    │                                     │  Select  │                  │ Face Cr. │ │
│  │██░░░ 14% │                                     │████ 50%  │                  │ FAILED   │ │
│  └──────────┘                                     └──────────┘                  │[Retry]   │ │
│                                                                                  └──────────┘ │
│                                                                                  │
│  ── quest path line (dashed, glows lime for completed segments) ──              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quest Card Design

### Standard Card (Processing)

```
┌─────────────────────────────────┐
│ ☁️ Cloud          ⚡ Scan       │  ← Character sprite (20px) + Status effect badge
│                                 │
│ Vitamin C Serum                 │  ← Product name (display font, bold, sm)
│ Skincare                        │  ← Category badge (mono, 11px, surface-overlay bg)
│                                 │
│ ████████░░░░ 35%               │  ← Mini ATB bar (character color, % = pipeline position)
│                                 │
│ 💰 0.02 Gil      2m ago        │  ← Gil cost + relative timestamp
└─────────────────────────────────┘
```

### Review Gate Card (YOUR TURN)

```
┌─────────────────────────────────┐
│ ▶ YOUR TURN                     │  ← Gold banner, pulsing animation
│                                 │
│ ☁️ Cloud          ⏳ Wait       │
│ Vitamin C Serum                 │
│ Skincare                        │
│                                 │
│ ████████░░░░ 35%               │  ← Bar paused, pulses gold
│                                 │
│ 💰 0.02 Gil      2m ago        │
│ [▶ Review Analysis]            │  ← Quick-action button (navigates to detail page section)
└─────────────────────────────────┘
```

### Victory Card (Completed)

```
┌─────────────────────────────────┐
│ ⭐ VICTORY                      │  ← Lime banner, star sparkle
│                                 │
│ ☁️ Cloud (attack)  🌟 Victory  │  ← Attack pose sprite
│ Vitamin C Serum                 │
│ Skincare                        │
│                                 │
│ ████████████ 100% ✓            │  ← Full lime bar with checkmark
│                                 │
│ 💰 5.58 Gil      1h ago        │
│ [▶ View Victory]               │  ← Links to final video
└─────────────────────────────────┘
```

### KO Card (Failed)

```
┌─────────────────────────────────┐
│ 💀 KO                          │  ← Magenta banner, skull icon
│                                 │
│ ☁️ Cloud (ko)     💀 KO        │  ← KO pose sprite
│ Face Cream Pro                  │
│ Skincare                        │
│                                 │
│ ████████░░░░ 65%  ✗            │  ← Bar stops at failure point, red
│ Failed at: Directing            │  ← Which stage failed (mono, 10px)
│                                 │
│ 💰 5.12 Gil      30m ago       │
│ [▶ Retry] [↩ Rollback]        │  ← Recovery actions
└─────────────────────────────────┘
```

### Card States

| State | Border | Sprite | ATB Bar | Special |
|-------|--------|--------|---------|---------|
| Processing | Character color (left accent) | Idle, subtle bounce | Filling with character color, animated | Status badge pulses |
| Review gate | Gold border glow, pulsing | Idle, highlighted | Paused, pulses gold | "▶ YOUR TURN" banner, quick-action button |
| Completed | Lime border | Attack pose | Full lime with checkmark | "⭐ VICTORY" banner, "View Victory" button |
| Failed | Magenta border | KO pose | Stops at failure point, red | "💀 KO" banner, "Retry"/"Rollback" buttons |

### Card Interactions

- **Hover:** Card lifts (translateY -2px), border brightens, sprite micro-bounce
- **Click card body:** Navigate to project detail page
- **Click quick-action button:** Navigate to project detail at relevant review section
- **Delete:** Hidden menu (three-dot or right-click), same confirm dialog as current

### ATB Progress Calculation

Each card shows overall pipeline progress as a percentage:

```typescript
const STAGE_ORDER = [
  'created', 'analyzing', 'analysis_review',
  'scripting', 'script_review',
  'broll_planning', 'broll_review',
  'influencer_selection', 'casting', 'casting_review',
  'directing', 'voiceover', 'broll_generation', 'asset_review',
  'editing', 'completed'
];
// progress = (indexOf(currentStatus) / (STAGE_ORDER.length - 1)) * 100
```

---

## Quick Actions at Review Gates

| Review Gate Status | Quick Action Label | Navigates To |
|-------------------|-------------------|--------------|
| `analysis_review` | "▶ Review Analysis" | Project detail → analysis section |
| `script_review` | "▶ Review Script" | Project detail → script section |
| `broll_review` | "▶ Review Storyboard" | Project detail → storyboard section |
| `influencer_selection` | "▶ Select Influencer" | Project detail → influencer section |
| `casting_review` | "▶ Review Assets" | Project detail → asset section |
| `asset_review` | "▶ Final Review" | Project detail → asset review section |
| `completed` | "▶ View Victory" | Project detail → final video |
| `failed` | "▶ Retry" / "↩ Rollback" | Triggers retry/rollback API, stays on board |

---

## Summary Stats Bar

Horizontal bar above the board showing quest overview:

```
⚔️ 3 In Battle    ▶ 4 Awaiting Orders    ⭐ 12 Victories    💀 1 KO    💰 67.42 Gil total
```

| Stat | What It Counts | Click Action |
|------|---------------|--------------|
| ⚔️ In Battle | All processing statuses | Filter board to processing projects only |
| ▶ Awaiting Orders | All review gate statuses | Filter to review gate projects (pulses when > 0) |
| ⭐ Victories | `completed` projects | Filter to completed |
| 💀 KO | `failed` projects | Filter to failed |
| 💰 Gil total | Sum of all project `cost_usd` | No filter — informational |

"Awaiting Orders" stat pulses with gold animation when any projects need user action — the primary attention driver.

---

## World Map Decorations

### Quest Path Line

Styled dashed/dotted line connecting all 6 location headers horizontally:
- Segments between completed locations: lime glow
- Current frontier segment: Mako pulse animation
- Future segments: muted gray dashes
- Brief lime flash animation when a project advances between locations

### Location Icons

Pixel-art icons (~32px) above each column header, generated via Nano Banana Pro:

| Location | Icon Description |
|----------|-----------------|
| Midgar | Dark city skyline silhouette with Mako reactor glow |
| Kalm | Small inn/house with warm window light |
| Cosmo Canyon | Observatory with eternal flame |
| Junon | Cannon barrel pointing right, port dock |
| Gold Saucer | Ferris wheel / event dome, golden glow |
| Northern Crater | Ice crystal formation, blue-white glow |

**Total: 6 images, ~$0.42 one-time cost**

### Terrain Gradient

Subtle horizontal background gradient behind columns (~5-8% opacity):
- Midgar: dark industrial gray-blue
- Kalm → Cosmo Canyon: green fields → orange/red canyon
- Junon: blue-gray ocean
- Gold Saucer: golden desert
- Northern Crater: icy white-blue

Applied as a CSS linear-gradient on the board container, purely atmospheric.

### Column Headers

Each column header shows:
- Location pixel icon (32px)
- Location name (display font, bold, sm)
- Character sprite leading this phase (20px, idle pose)
- Project count in parentheses
- Bottom border in character's accent color

---

## Animations

| Animation | Trigger | Effect |
|-----------|---------|--------|
| `quest-advance` | Project moves to next column (poll refresh) | Card slides horizontally 500ms ease-out, brief lime trail |
| `boss-encounter` | Project reaches a review gate | Gold border flash, "YOUR TURN" fades in, sprite steps forward |
| `victory-arrive` | Project reaches `completed` | Card slides into Northern Crater, star burst particles, lime glow |
| `ko-fall` | Project fails | Card shakes 300ms, KO spiral fades in, red flash |
| `column-glow` | Column has active processing projects | Faint Mako pulse on column header (2s cycle) |
| `path-flash` | Any project advances between locations | Path segment between old/new location flashes lime 500ms |
| `awaiting-pulse` | Projects need user action | "Awaiting Orders" stat and review gate cards pulse gold (2s cycle) |

---

## Empty Board State

No projects: the world map path is drawn but all locations are dark/locked. Cloud stands alone at Midgar.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  🏙️ -------- 🔒 -------- 🔒 -------- 🔒 -------- 🔒 -------- 🔒  │
│  MIDGAR      KALM       COSMO       JUNON      GOLD      CRATER   │
│                                                          │
│              ☁️                                           │
│         No quests active.                                │
│     Begin your first encounter.                          │
│                                                          │
│            [▶ New Quest]                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/quest-board.tsx` | Main Kanban board — columns, path, terrain, stats bar, search, empty state |
| `src/components/quest-card.tsx` | Project card with ATB bar, sprite, status badge, quick actions |
| `src/components/quest-column.tsx` | Single location column with header, icon, scroll container, count |
| `src/components/quest-path.tsx` | Decorative path line + location icons connecting columns |
| `src/components/quest-stats.tsx` | Summary stats bar (In Battle / Awaiting Orders / Victories / KO / Gil) |
| `public/ff7/locations/` | 6 pixel-art location icons |

## Modified Files

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Replace `ProjectList` with `QuestBoard`. Same data fetch, new component. |

## Kept Files (Not Deleted)

| File | Reason |
|------|--------|
| `src/components/project-list.tsx` | Kept as fallback list view. Could add a toggle (board/list) in the future. |
| `src/components/project-card.tsx` | Used by project-list.tsx. Not modified. |

## Unchanged

- All API routes — zero backend changes
- Project detail page — untouched
- Pipeline logic — no status or workflow changes
- Data shapes — same Supabase query
- Delete functionality — available on cards via hidden menu
- Navigation — "Projects" tab still exists, points to same `/` route

---

## Acceptance Criteria

### Board Layout
- [ ] 6 columns mapped to pipeline phases (Midgar → Kalm → Cosmo Canyon → Junon → Gold Saucer → Northern Crater)
- [ ] Projects sorted into correct column by current status
- [ ] Failed projects appear in the column where they failed (using `failed_at_status`)
- [ ] Columns scroll independently (vertical overflow)
- [ ] Horizontal scroll on mobile for the full board
- [ ] Quest path dashed line connecting location headers (lime for completed segments, gray for future)
- [ ] Location pixel icons (~32px) above each column
- [ ] Terrain gradient background (~5-8% opacity, atmospheric)
- [ ] Column headers: location icon + name + character sprite + project count

### Quest Cards
- [ ] Product name, category badge, character sprite (idle/attack/ko), status effect badge
- [ ] Mini ATB progress bar (character color fill, % based on pipeline position)
- [ ] Gil cost display with coin icon
- [ ] Relative timestamp
- [ ] Click card body → navigate to project detail page
- [ ] Hover: card lifts, border brightens, sprite micro-bounce

### Quick Actions
- [ ] "▶ YOUR TURN" gold banner on review gate cards with pulse animation
- [ ] Quick-action button at each review gate (navigates to relevant detail section)
- [ ] Completed cards: "⭐ VICTORY" banner + "▶ View Victory" button
- [ ] Failed cards: "💀 KO" banner + "▶ Retry" / "↩ Rollback" buttons
- [ ] Retry/rollback trigger API calls directly from the board

### Stats Bar
- [ ] "In Battle" / "Awaiting Orders" / "Victories" / "KO" / "Gil total" counts
- [ ] Clicking a stat filters the board to matching projects
- [ ] "Awaiting Orders" pulses gold when projects need user action

### Animations
- [ ] `quest-advance`: card slides between columns on status change
- [ ] `boss-encounter`: gold flash + "YOUR TURN" on reaching review gate
- [ ] `victory-arrive`: star burst when project completes
- [ ] `ko-fall`: shake + KO overlay on failure
- [ ] `path-flash`: path segment lights up when project advances
- [ ] `awaiting-pulse`: gold pulse on review gate cards and "Awaiting Orders" stat

### Search & Empty State
- [ ] Search bar filters across all columns (product name, project name, URL)
- [ ] Empty board: world map with locked locations, Cloud at Midgar, "No quests active" message
- [ ] "▶ New Quest" button links to project creation

### Assets
- [ ] 6 location pixel icons generated via Nano Banana Pro (~$0.42)
- [ ] Saved to `public/ff7/locations/`

---

## Parallel Work Analysis

```
PARALLEL WORK ANALYSIS:

- Task A (assets): Generate 6 location pixel icons via Nano Banana Pro
  Files: public/ff7/locations/*.png
  Independent: YES

- Task B (frontend): Quest Board shell — columns, path, stats bar, empty state
  Files: src/components/quest-board.tsx (NEW), src/components/quest-column.tsx (NEW),
         src/components/quest-path.tsx (NEW), src/components/quest-stats.tsx (NEW)
  PARTIALLY BLOCKED by Task A (needs location icons, but can use placeholders)

- Task C (frontend): Quest Card component with ATB bar, quick actions, card states
  Files: src/components/quest-card.tsx (NEW)
  Independent of Task B (new file, no shared state)
  CAN RUN in parallel with Task B

- Task D (frontend): Wire board into page + animations
  Files: src/app/page.tsx (modify)
  BLOCKED by Task B + C (needs both board shell and card components)

Recommendation:
  Step 1: Task A (assets) + Task B (board shell) + Task C (quest card) — all in parallel
  Step 2: Task D (wire into page + animations) — after B + C
```
