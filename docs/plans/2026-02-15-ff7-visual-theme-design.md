# FF7 Visual Theme — Full App Theming

**Date:** 2026-02-15
**Status:** APPROVED
**Priority:** P1 - High (Tier 1.5)
**Effort:** Medium

---

## Problem Statement

The app has a solid dark cinematic aesthetic but no distinctive identity. It looks like a generic AI dashboard. The engineering roadmap already uses FF7 characters (Cloud, Tifa, Barret, Aerith, Red XIII) as worker identities for the Kanban board. This theme extends that identity across the entire app — the AI pipeline becomes a turn-based battle, agents become party members, and the user commands their team to victory.

## Solution

Overlay the existing UI with a Final Fantasy VII visual theme. The pipeline becomes an Active Time Battle system. Each AI agent is an FF7 character. Status badges become status effects. Costs display as Gil. Review gates become battle command menus. All assets are AI-generated pixel sprites via Nano Banana Pro.

**Hard constraints:**
- Workflow does NOT change — same stages, same gates, same actions
- Names do NOT change — Dashboard, Products, Influencers keep their labels
- No backend changes — purely frontend + static assets
- No audio (future enhancement)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Battle metaphor intensity | Full ATB bar | Pipeline stages = turns with charging gauges. Processing = bar filling. Review = your turn. Completed = attack landed. |
| Icon vocabulary | Character-driven | FF7 party members are the visual identity everywhere, not just Kanban workers |
| Character-agent mapping | Battle party | AI agents ARE FF7 characters. Pipeline execution = party attacking the "Blank Video" boss |
| Art style | Pixel sprites (PS1-era) | 32x64 static PNGs. Nostalgic, lightweight, instantly recognizable. CSS sprite-sheet animations during battle |
| Asset source | Nano Banana Pro generation | Generate all sprites/icons/scenes with our own pipeline. ~26 images, ~$1.82 one-time cost |

---

## Character-Agent Mapping

| Agent | FF7 Character | Battle Action | Stage Color | Sprite Poses |
|-------|--------------|---------------|-------------|-------------|
| ProductAnalyzerAgent | **Cloud Strife** | "Braver" slash — reconnaissance strike | Mako cyan `#00e5a0` | idle, attack, ko |
| ScriptingAgent | **Tifa Lockhart** | "Beat Rush" combo — precision scripting | Chocobo gold `#ffc933` | idle, attack, ko |
| B-RollAgent | **Aerith Gainsborough** | "Healing Wind" — summons visual support | Cure green `#7aff6e` | idle, attack, ko |
| CastingAgent | **Red XIII** | "Sled Fang" — generates keyframe images | Flame orange `#ff8c42` | idle, attack, ko |
| DirectorAgent | **Barret Wallace** | "Big Shot" — heavy video generation | Ifrit red `#ff2d55` | idle, attack, ko |
| VoiceoverAgent | **Cait Sith** | "Dice" — voice synthesis | Purple `#b388ff` | idle, attack, ko |
| EditorAgent | **Limit Break** (all) | Final composition — party combines | Cure green `#7aff6e` | all characters jump |

---

## ATB Pipeline System

Replaces the current dot-and-line pipeline progress with an Active Time Battle interface.

### ATB Bar Mechanics

```
┌──────────────────────────────────────────────────────┐
│  [Cloud sprite]  ANALYZE   ████████████████░░░░  78%  │  ← ATB bar filling
│  [Tifa sprite]   SCRIPT    ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
│  [Aerith sprite] B-ROLL    ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
│  [RedXIII sprite] CAST     ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
│  [Barret sprite] DIRECT    ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
│  [Cait sprite]   VOICE     ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
│  [ALL sprites]   LIMIT BRK ░░░░░░░░░░░░░░░░░░░░  --  │  ← Waiting
└──────────────────────────────────────────────────────┘
```

**States per stage:**
- **Waiting:** Gray bar, dimmed sprite, muted text
- **Charging (processing):** Mako-green bar fills left-to-right with glow animation, sprite in idle pose, bright text
- **Ready (review gate):** Full bar pulses gold, "YOUR TURN" flashes, command menu appears
- **Completed:** Sprite plays attack animation, bar turns lime, checkmark replaces percentage
- **Failed:** Sprite plays KO animation, bar turns red, "KO" text

### Battle HUD (Project Detail)

Wraps the project detail page during pipeline execution:

```
┌─────────────────────────────────────────────────────────────────┐
│  Gil: 2.34                                    MP: ████████░░   │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   YOUR PARTY             │          BLANK VIDEO                 │
│                          │          ┌──────────────────┐        │
│   [Cloud]  ████████ OK   │          │                  │        │
│   [Tifa]   ████░░░░ ATB  │          │   HP ████████░░  │        │
│   [Aerith] ░░░░░░░░ --   │          │   (60% remaining)│        │
│   [RedXIII]░░░░░░░░ --   │          │                  │        │
│   [Barret] ░░░░░░░░ --   │          └──────────────────┘        │
│   [Cait]   ░░░░░░░░ --   │                                      │
│                          │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│  ┌───────────────┐                                              │
│  │ ▶ Approve     │  ← Command menu (at review gates)           │
│  │   Regenerate  │                                              │
│  │   Edit        │                                              │
│  │   Reject      │                                              │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Enemy "Blank Video" boss:**
- HP bar starts at 100%, depletes as stages complete
- Each completed stage = damage dealt (HP drops proportionally: 7 stages = ~14% per stage)
- At 0% HP (all stages done): victory fanfare animation
- Visual: empty video frame that fills with content as stages complete

---

## Status Effects (Badge Replacements)

| Current Badge | FF7 Status Effect | Icon | Colors (unchanged mapping) |
|--------------|-------------------|------|---------------------------|
| created | **Idle** | — (no icon) | Gray/muted |
| analyzing | **Scan** | Eye icon | Mako cyan, pulse |
| analysis_review | **Wait** | Hourglass | Chocobo gold |
| scripting | **Haste** | Speed arrows | Mako cyan, pulse |
| script_review | **Wait** | Hourglass | Chocobo gold |
| broll_planning | **Pray** | Folded hands | Mako cyan, pulse |
| broll_review | **Wait** | Hourglass | Chocobo gold |
| influencer_selection | **Recruit** | Party icon | Chocobo gold |
| casting | **Summon** | Magic circle | Mako cyan, pulse |
| casting_review | **Wait** | Hourglass | Chocobo gold |
| directing | **Fury** | Flame aura | Mako cyan, pulse |
| voiceover | **Esuna** | Music note | Mako cyan, pulse |
| asset_review | **Wait** | Hourglass | Chocobo gold |
| editing | **Barrier** | Shield | Mako cyan, pulse |
| completed | **Victory** | Star | Cure green |
| failed | **KO** | Spiral/X | Ifrit red |

---

## Mako-Shifted Color Palette

Subtle shifts from TikTok neon to FF7 Mako energy:

```css
/* Core palette shifts */
--color-electric: #00e5a0;      /* was #00f0ff — Mako reactor green-cyan */
--color-magenta: #ff2d55;       /* was #ff2d78 — Ifrit red, warmer */
--color-lime: #7aff6e;          /* was #b8ff00 — Cure spell green, softer */
--color-amber-hot: #ffc933;     /* was #ff9500 — Chocobo gold, warmer */
--color-void: #08080e;          /* was #0a0a0f — Midgar dark, negligible */

/* New FF7-specific tokens */
--color-mako: #00e5a0;          /* Primary Mako energy */
--color-mako-dim: #007a55;      /* Dimmed Mako */
--color-gil: #ffc933;           /* Gil/gold */
--color-phoenix: #ff6b3d;       /* Phoenix Down orange */
--color-summon: #b388ff;        /* Summon magic purple */
```

---

## UI Element Transformations

### Navigation Bar

- **Logo mark:** Replace gradient play-button with pixel Buster Sword icon (~20px)
- **Menu items:** Small Materia orb dot before each link (green=active, blue=inactive)
- **"New Project" button:** Command menu style — bordered box with "▶" cursor prefix
- **Version area:** Gil display — small coin icon + session/total cost

### Project Cards → Battle Reports

- Small character sprite of **current active agent** in card corner (~24px)
- Progress as mini HP-bar gauge (same data, visual change)
- Cost shown as "Gil: X.XX" with coin icon
- Failed cards: KO spiral icon, red tint

### Review Gates → Command Menu

At every review gate, action buttons render as FF7 command menu:
```
┌─────────────────┐
│ ▶ Approve       │
│   Regenerate    │
│   Edit          │
│   Reject        │
└─────────────────┘
```
- Bordered box, vertical stack, "▶" cursor on active/hovered item
- Same functionality — Approve calls the same API, Regenerate does the same thing

### Empty States

| Page | FF7 Empty State |
|------|----------------|
| Projects (no projects) | Party standing in empty field — "No encounters yet. Start a new battle." |
| Products (no products) | Item shop counter — "No items in inventory." |
| Influencers (no influencers) | Character select screen — "Party not assembled." |

### Cost Display → Gil

All cost references use Gil coin icon (pixel art, ~12px inline). "$5.58" → "5.58" with Gil coin prefix. Mono font, same placement.

---

## Battle Animations

| Animation | Trigger | CSS Effect |
|-----------|---------|------------|
| `atb-fill` | Stage processing | Bar fills L→R with Mako glow, duration scales to expected stage time |
| `atb-ready` | Review gate reached | Bar pulses gold, "YOUR TURN" text fades in/out |
| `attack-flash` | Stage completes | Sprite slides forward 20px, screen flashes white 100ms, returns |
| `ko-spin` | Stage fails | Sprite rotates 360° and drops 10px, fades to 50% opacity |
| `victory-fanfare` | Pipeline completes | All sprites jump (translateY -20px bounce), stars/confetti particles, "VICTORY" text scales in |
| `limit-charge` | Editor stage | Golden gauge fills, pulses at 100%, triggers victory on completion |
| `enemy-hp-drain` | Any stage completes | Enemy HP bar smoothly decreases (transition 1s ease-out) |
| `command-cursor` | Review gate hover | "▶" cursor blinks 0.5s interval, moves vertically on hover |
| `materia-pulse` | Active nav item | Orb glow pulses (replaces current pulse-glow) |
| `damage-number` | Stage completes | Number floats up 30px and fades out (like FF7 damage text) |

---

## Sprite Asset List

All generated via Nano Banana Pro with pixel-art prompts. Saved to `public/ff7/`.

### Characters (`public/ff7/characters/`)

| Asset | Prompt Direction | Size |
|-------|-----------------|------|
| `cloud-idle.png` | FF7 PS1-era pixel sprite, Cloud Strife standing idle, Buster Sword on back, transparent bg | 64x64 |
| `cloud-attack.png` | FF7 pixel sprite, Cloud Strife mid-sword-slash, Buster Sword forward, transparent bg | 64x64 |
| `cloud-ko.png` | FF7 pixel sprite, Cloud Strife knocked out, fallen pose, transparent bg | 64x64 |
| `tifa-idle.png` | FF7 pixel sprite, Tifa Lockhart standing idle, fighting stance, transparent bg | 64x64 |
| `tifa-attack.png` | FF7 pixel sprite, Tifa Lockhart mid-punch combo, transparent bg | 64x64 |
| `tifa-ko.png` | FF7 pixel sprite, Tifa Lockhart knocked out, transparent bg | 64x64 |
| `aerith-idle.png` | FF7 pixel sprite, Aerith Gainsborough standing with staff, transparent bg | 64x64 |
| `aerith-attack.png` | FF7 pixel sprite, Aerith casting healing magic, green glow, transparent bg | 64x64 |
| `aerith-ko.png` | FF7 pixel sprite, Aerith knocked out, transparent bg | 64x64 |
| `redxiii-idle.png` | FF7 pixel sprite, Red XIII standing, flame tail, transparent bg | 64x64 |
| `redxiii-attack.png` | FF7 pixel sprite, Red XIII leaping forward attacking, transparent bg | 64x64 |
| `redxiii-ko.png` | FF7 pixel sprite, Red XIII knocked out, transparent bg | 64x64 |
| `barret-idle.png` | FF7 pixel sprite, Barret Wallace standing, gun arm raised, transparent bg | 64x64 |
| `barret-attack.png` | FF7 pixel sprite, Barret firing gun arm, muzzle flash, transparent bg | 64x64 |
| `barret-ko.png` | FF7 pixel sprite, Barret knocked out, transparent bg | 64x64 |
| `cait-idle.png` | FF7 pixel sprite, Cait Sith on moogle, standing idle, transparent bg | 64x64 |
| `cait-attack.png` | FF7 pixel sprite, Cait Sith throwing dice, transparent bg | 64x64 |
| `cait-ko.png` | FF7 pixel sprite, Cait Sith knocked out on moogle, transparent bg | 64x64 |

### Icons (`public/ff7/icons/`)

| Asset | Prompt Direction | Size |
|-------|-----------------|------|
| `gil-coin.png` | Pixel art gold coin, FF7 Gil currency, transparent bg | 16x16 |
| `materia-green.png` | Pixel art green Materia orb, glowing, transparent bg | 12x12 |
| `materia-blue.png` | Pixel art blue Materia orb, transparent bg | 12x12 |
| `materia-red.png` | Pixel art red Materia orb, transparent bg | 12x12 |
| `materia-yellow.png` | Pixel art yellow Materia orb, transparent bg | 12x12 |
| `materia-purple.png` | Pixel art purple Materia orb, transparent bg | 12x12 |
| `buster-sword.png` | Pixel art Buster Sword, FF7 style, vertical, transparent bg | 24x24 |
| `command-cursor.png` | FF7 battle menu pointer/cursor triangle, white, transparent bg | 12x12 |

### Scenes (`public/ff7/scenes/`)

| Asset | Prompt Direction | Size |
|-------|-----------------|------|
| `battle-bg.png` | FF7 pixel art battle background, Midgar reactor interior, dark moody | 800x200 |
| `empty-field.png` | FF7 pixel art, party of characters standing in empty grassland, no enemies | 400x200 |
| `item-shop.png` | FF7 pixel art, interior of item shop counter, shelves empty | 400x200 |
| `party-select.png` | FF7 pixel art, character selection screen with empty slots | 400x200 |
| `victory.png` | FF7 pixel art, party celebrating victory pose, stars and sparkles | 400x200 |

**Total: 30 images, ~$2.10 one-time cost**

---

## New Files

| File | Purpose |
|------|---------|
| `public/ff7/characters/*.png` | Character sprite assets (18 files) |
| `public/ff7/icons/*.png` | Icon assets (8 files) |
| `public/ff7/scenes/*.png` | Scene/background assets (5 files) |
| `src/lib/ff7-theme.ts` | Theme constants: character-agent map, status-effect labels, battle text, Gil formatter |
| `src/components/atb-bar.tsx` | ATB gauge component for individual pipeline stages |
| `src/components/battle-hud.tsx` | Battle HUD overlay for project detail (party, enemy HP, command menu) |
| `src/components/ff7-sprite.tsx` | Reusable character sprite component (idle/attack/ko, sizing) |
| `src/components/command-menu.tsx` | FF7-style vertical command menu for review gate actions |
| `src/components/gil-display.tsx` | Cost display with Gil coin icon |

## Modified Files

| File | Changes |
|------|---------|
| `src/app/globals.css` | Mako-shifted color vars, new battle animations (atb-fill, attack-flash, ko-spin, victory-fanfare, etc.) |
| `src/components/nav.tsx` | Buster Sword logo, Materia nav dots, command-style "New Project" button, Gil counter |
| `src/components/status-badge.tsx` | FF7 status-effect labels + tiny icons |
| `src/components/pipeline-progress.tsx` | **Major rewrite** — ATB bar system with character sprites per stage |
| `src/components/project-card.tsx` | Active character sprite, HP-bar gauge, Gil cost, KO icon |
| `src/components/project-detail.tsx` | Battle HUD wrapper during processing, command menu at review gates |
| `src/components/segment-card.tsx` | Character sprite on section headers |
| `src/components/project-list.tsx` | "No encounters" empty state |
| `src/components/product-list.tsx` | "No items in inventory" empty state |
| `src/components/influencer-list.tsx` | "Party not assembled" empty state |

## Unchanged

- All API routes — zero backend changes
- All data shapes — no DB or type changes
- All routing — same URLs
- All labels — Dashboard, Products, Influencers stay as-is
- All workflow — same pipeline stages, same review gates, same approve/reject/regenerate

---

## Theme Toggle Architecture (Future)

All FF7-specific content is isolated for future theme swapping:

| Layer | Isolation |
|-------|-----------|
| **Assets** | `public/ff7/` — swap entire folder for different theme |
| **Labels** | `src/lib/ff7-theme.ts` — single constant file with all FF7 text (status names, empty states, battle text) |
| **Colors** | CSS variables in `globals.css` — override block per theme |
| **Components** | New components (`atb-bar`, `battle-hud`, `ff7-sprite`, `command-menu`, `gil-display`) are theme-specific wrappers — swap them out for different theme components |

Future themes could include Pokemon, Dragon Ball, default/minimal, etc.

---

## Acceptance Criteria

### Asset Generation
- [ ] Generate all 30 pixel sprite assets via Nano Banana Pro
- [ ] Manual QA pass — regenerate any that don't match FF7 PS1 pixel style
- [ ] All assets saved to `public/ff7/` with correct directory structure
- [ ] All assets are transparent-background PNGs

### Theme Constants
- [ ] `ff7-theme.ts` exports: CHARACTER_AGENT_MAP, STATUS_EFFECTS, BATTLE_TEXT, formatGil()
- [ ] Character-agent mapping matches the table above (Cloud=Analyzer, Tifa=Scripting, etc.)
- [ ] Status effects map all 15+ pipeline statuses to FF7 names + icons

### Color Palette
- [ ] Mako-shifted colors applied via CSS variable overrides in globals.css
- [ ] Electric → Mako green-cyan, Magenta → Ifrit red, Lime → Cure green, Amber → Chocobo gold
- [ ] All existing components inherit new colors without per-component changes

### ATB Pipeline
- [ ] ATB bar component replaces dot-line pipeline progress
- [ ] Each stage shows character sprite + stage name + filling gauge
- [ ] Processing stages: bar fills with Mako glow animation
- [ ] Review gates: bar pulses gold, "YOUR TURN" text
- [ ] Completed stages: attack animation, lime bar, checkmark
- [ ] Failed stages: KO animation, red bar, "KO" text

### Battle HUD
- [ ] Project detail page wraps in battle HUD during pipeline execution
- [ ] Party lineup on left (character sprites with ATB status)
- [ ] Enemy "Blank Video" on right with HP bar that depletes per stage
- [ ] Gil counter (cost) and MP gauge (top bar)
- [ ] Command menu appears at review gates (Approve/Regenerate/Edit/Reject)

### Navigation
- [ ] Buster Sword pixel icon replaces gradient play-button logo
- [ ] Materia orb dots on nav menu items (green=active, blue=inactive)
- [ ] "New Project" button styled as command menu item with "▶" prefix
- [ ] Gil display in version/cost area

### Status Badges
- [ ] All pipeline statuses show FF7 status-effect names
- [ ] Tiny status-effect icons on each badge
- [ ] Same color mapping (processing=cyan, review=gold, success=green, failed=red)

### Project Cards
- [ ] Active character sprite in card corner (~24px)
- [ ] Progress as HP-bar gauge
- [ ] Cost as Gil display
- [ ] Failed cards: KO icon

### Empty States
- [ ] Projects: "No encounters yet" with party-in-field scene
- [ ] Products: "No items in inventory" with item shop scene
- [ ] Influencers: "Party not assembled" with character select scene

### Animations
- [ ] atb-fill: smooth L→R bar fill with glow
- [ ] attack-flash: sprite slides + white flash on stage complete
- [ ] ko-spin: sprite rotates + drops on failure
- [ ] victory-fanfare: all sprites jump + stars on pipeline complete
- [ ] command-cursor: blinking ▶ on review gate menu
- [ ] enemy-hp-drain: smooth HP bar decrease
- [ ] damage-number: float-up number on stage complete

---

## Parallel Work Analysis

```
PARALLEL WORK ANALYSIS:

- Task A (assets): Generate all 30 pixel sprites via Nano Banana Pro
  Files: public/ff7/**
  Independent: YES (no code dependencies)

- Task B (backend-ish): Theme constants file
  Files: src/lib/ff7-theme.ts (NEW)
  Independent: YES (new file, no conflicts)

- Task C (frontend): Color palette + animations in globals.css
  Files: src/app/globals.css
  Independent: YES (additive CSS, no conflicts with Task D-F)

- Task D (frontend): New components (atb-bar, battle-hud, ff7-sprite, command-menu, gil-display)
  Files: src/components/atb-bar.tsx, battle-hud.tsx, ff7-sprite.tsx, command-menu.tsx, gil-display.tsx (ALL NEW)
  BLOCKED by Task A (needs sprite assets) + Task B (needs theme constants)
  PARTIALLY BLOCKED by Task C (needs new CSS animations)

- Task E (frontend): Modify existing components (nav, status-badge, project-card, empty states)
  Files: src/components/nav.tsx, status-badge.tsx, project-card.tsx, project-list.tsx, product-list.tsx, influencer-list.tsx
  BLOCKED by Task A + B + D (needs sprites, constants, new components)

- Task F (frontend): Pipeline + project detail rewrite (ATB system, battle HUD)
  Files: src/components/pipeline-progress.tsx, project-detail.tsx, segment-card.tsx
  BLOCKED by Task A + B + C + D (needs everything)

Recommendation:
  Step 1: Task A (asset gen) + Task B (constants) + Task C (CSS) — all in parallel
  Step 2: Task D (new components) — after A + B + C
  Step 3: Task E (modify existing) + Task F (pipeline rewrite) — after D
           E and F can run in parallel IF they don't share files (they don't)
```
