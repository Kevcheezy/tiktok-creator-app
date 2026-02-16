# Scene & Interaction Presets — Casting Visual Configuration

**Date:** 2026-02-15
**Status:** APPROVED
**Priority:** P1 - High (Tier 1.5)
**Effort:** Medium

---

## Problem Statement

The CastingAgent builds keyframe prompts using a `setting` field that comes from three disconnected sources: static `ai_character.setting` from seed data, `AVATAR_MAPPING` category fallback, and optional SEAL data from video analysis. None give the user direct control over the scene. If the setting description shifts subtly between segments, keyframes look like they were shot in different rooms — breaking the illusion of a continuous UGC shoot.

Additionally, there's no way to describe HOW the creator interacts with the product. The `PRODUCT_PLACEMENT_ARC` handles visibility (none/subtle/hero/set_down) but not physical choreography — stirring a powder, applying a serum, trying on pants. These interactions are what make UGC feel authentic and drive conversions.

## Solution

Two independent preset systems that the user configures at influencer selection:

1. **Scene presets** — WHERE the video is shot (bedroom ring light, bathroom vanity, kitchen counter, etc.)
2. **Interaction presets** — HOW the creator engages with the product (hold & show, stir/mix, apply to skin, etc.)

The CastingAgent combines both into a single coherent prompt with a consistency rule ensuring all 4 segments look like one continuous shoot.

**Hard constraints:**
- Scene is locked across all 4 segments (same room, lighting, props)
- CastingAgent makes subtle micro-adjustments per segment (angle, warmth matching energy arc)
- Existing `PRODUCT_PLACEMENT_ARC` (visibility) and `ENERGY_ARC` stay unchanged
- Old projects without presets fall back to `ai_character.setting`

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When to select scene | At influencer selection | Scene is tightly coupled with who appears — same person in bedroom vs. pharmacy are different videos |
| Scene + interaction relationship | Two independent dimensions | Scene = WHERE, Interaction = HOW. Independent choices keep scenes reusable across product types |
| Preset count | 7 scenes + 10 interactions | Curated for viral UGC formats, each with detailed prompts. User can add custom. |
| Per-segment variation | One scene with micro-adjustments | Locked base scene, CastingAgent adjusts framing/warmth per energy arc. Looks like one continuous shoot. |
| Interaction presets | Predefined + custom | 10 defaults covering common product types. User can write custom for niche products. |

---

## Data Model

### `scene_preset` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Short name: "Bedroom Ring Light", "Car Confessional" |
| `description` | text | Full detailed scene prompt (50+ words, specifies lighting, props, camera, aesthetic) |
| `category_affinity` | jsonb | Product categories this scene works best for (for smart sorting) |
| `virality_notes` | text | Why this scene converts — shown to user as guidance |
| `is_default` | boolean | Default for new projects (Bedroom Ring Light) |
| `is_custom` | boolean | User-created vs. system preset |
| `sort_order` | integer | Display ordering |
| `created_at` | timestamptz | Auto-set |

### `interaction_preset` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Short name: "Hold & Show", "Stir / Mix" |
| `description` | text | Full detailed interaction prompt with choreography |
| `category_affinity` | jsonb | Product categories this interaction suits |
| `is_default` | boolean | Default for new projects (Hold & Show) |
| `is_custom` | boolean | User-created vs. system preset |
| `sort_order` | integer | Display ordering |
| `created_at` | timestamptz | Auto-set |

### Project Table Changes

| Column | Type | Description |
|--------|------|-------------|
| `scene_preset_id` | uuid FK → `scene_preset.id` (nullable) | Selected scene preset |
| `scene_override` | text (nullable) | Custom scene text (takes precedence over preset) |
| `interaction_preset_id` | uuid FK → `interaction_preset.id` (nullable) | Selected interaction preset |
| `interaction_override` | text (nullable) | Custom interaction text (takes precedence over preset) |

### Priority Order (CastingAgent reads)

**Scene:**
1. `project.scene_override` (custom text) — highest priority
2. `scene_preset.description` (via `project.scene_preset_id`)
3. `ai_character.setting` — legacy fallback for old projects

**Interaction:**
1. `project.interaction_override` (custom text) — highest priority
2. `interaction_preset.description` (via `project.interaction_preset_id`)
3. Current `PRODUCT_PLACEMENT_ARC` description — legacy fallback

---

## Default Scene Presets (7)

### 1. Bedroom Ring Light (DEFAULT)

**Title:** Bedroom Ring Light
**Category affinity:** skincare, fashion, beauty (universal default)

> Authentic UGC bedroom talking-head shot. Natural ring light creates visible circular catchlights in eyes and slightly uneven illumination typical of home content creators — soft warm glow, gentle shadows on face, not studio-grade. Unmade bed partially visible in background, fairy lights or LED strip on wall. Phone mounted on tripod at eye level. The aesthetic says 'real person in their bedroom' not 'polished advertisement' — credible authority meets relatable creator.

**Virality notes:** Ring light catchlights signal authenticity to TikTok viewers — it reads as 'real creator' not 'paid ad'. The bedroom setting creates intimacy and trust.

### 2. Bathroom Vanity

**Title:** Bathroom Vanity
**Category affinity:** skincare, haircare, dental, personal care

> Morning/evening routine setting. Bathroom mirror with vanity lighting casting even front illumination. Marble or white tile countertop with a few personal care products visible. Slightly steamy atmosphere suggesting recent shower. Camera positioned as if propped on counter, slightly below eye level. Natural, intimate, 'getting ready' energy — the viewer feels like they walked into a friend's bathroom routine.

**Virality notes:** The bathroom routine is one of the most-watched UGC formats on TikTok. Viewers watch 'get ready with me' content for the parasocial intimacy — they feel like they're there.

### 3. Kitchen Counter Morning

**Title:** Kitchen Counter Morning
**Category affinity:** supplements, food, kitchen, health

> Bright kitchen setting with natural window light flooding from one side. Clean white or light wood countertop with a coffee mug, maybe a fruit bowl. Casual morning energy — subject appears mid-routine, not posed. Phone propped against something on counter. Warm, welcoming, 'sharing a discovery over breakfast' feel.

**Virality notes:** Morning routine content outperforms other times-of-day on TikTok. The kitchen setting signals health-consciousness and everyday integration of the product.

### 4. Car Confessional

**Title:** Car Confessional
**Category affinity:** any (universal — high virality format)

> Parked car interior, natural daylight through windshield creating high-contrast front lighting. Steering wheel partially visible at bottom of frame. Close-up framing, slightly below eye level (phone in cupholder mount). Intimate, unfiltered, 'I have to tell you about this' energy — the car confession is one of the most viral UGC formats because it feels spontaneous and private.

**Virality notes:** Car confessional format has one of the highest completion rates on TikTok. The confined space forces close-up framing and the setting implies the creator couldn't wait to share — they're in their car right after trying the product.

### 5. Gym Mirror Selfie

**Title:** Gym Mirror Selfie
**Category affinity:** fitness, supplements, activewear

> Gym setting reflected in a large wall mirror. Bright fluorescent overhead lighting with some natural light from windows. Exercise equipment partially visible in background. Subject holding phone at chest height for mirror shot. Slightly sweaty, post-workout energy. Athletic wear.

**Virality notes:** Gym mirror content performs well because it provides social proof of an active lifestyle. The mirror format is a TikTok native — viewers are used to consuming this format.

### 6. Outdoor Walk-and-Talk

**Title:** Outdoor Walk-and-Talk
**Category affinity:** fitness, wellness, fashion

> Natural outdoor setting — park path, sidewalk, or backyard. Bright overcast daylight (soft, even illumination, no harsh shadows). Subject at arm's length, slight motion blur on background suggesting walking. Earbuds visible suggesting casual on-the-go moment. 'I was just on a walk and had to tell you' energy — movement keeps viewer engaged.

**Virality notes:** Motion in the frame increases watch time. The outdoor walk format signals spontaneity — the creator felt compelled to share mid-walk. Overcast light is the most flattering natural lighting.

### 7. Cozy Desk / Study

**Title:** Cozy Desk / Study
**Category affinity:** tech, books, productivity, electronics

> Home office or study nook. Warm desk lamp providing key light from one side, cool monitor glow filling the other side. Books, plants, or tasteful decor in soft focus background. Subject looking directly at camera (webcam angle, slightly above eye level). Smart, trustworthy, 'I researched this so you don't have to' energy.

**Virality notes:** The desk setup signals authority and research. The dual lighting (warm lamp + cool monitor) creates a cinematic look that reads as 'intellectual creator' — builds credibility for product claims.

---

## Default Interaction Presets (10)

### 1. Hold & Show (DEFAULT)

> Creator holds product at chest height with one hand, angled toward camera so label/branding is visible. Occasionally gestures with free hand while talking. During hero segment, brings product closer to camera for detail shot. Natural, relaxed grip — not a forced product placement pose.

**Category affinity:** universal (works for any handheld product)

### 2. Stir / Mix into Drink

> Creator scoops or pours product (powder, liquid) into a glass or shaker bottle. Stirs with spoon or shakes with cap on. Lifts glass to take a sip. Props: clear glass or shaker bottle on surface, spoon nearby. Choreography flows from scoop → stir → sip → reaction. Natural kitchen or bedside table surface.

**Category affinity:** supplements, food, beverages, protein

### 3. Apply to Skin

> Creator dispenses product (dropper, pump, squeeze) onto fingertips. Applies to face/hand/arm with gentle patting or rubbing motion. Camera close enough to see texture and application. During problem segment: touches bare skin. During solution segment: applies product. During CTA: shows result/glow.

**Category affinity:** skincare, haircare, beauty, personal care

### 4. Try On / Wear

> Creator holds up clothing/accessory item, then puts it on or models it. Before: plain outfit. After: styled with product. Camera angle allows full view of item. Choreography: hold up → put on → adjust → pose → turn.

**Category affinity:** fashion, jewelry, accessories, activewear

### 5. Unbox / Reveal

> Creator opens product packaging on camera. Box or mailer on surface, hands tear/open/unwrap. Pull product out, hold up for first reveal. Express genuine reaction. Props: shipping box, tissue paper, product packaging. 'First impressions' energy — the unboxing format is proven viral.

**Category affinity:** any (especially new launches, premium packaging)

### 6. Demonstrate Tool / Device

> Creator uses the product as a tool/device — turns it on, uses it on body/surface, shows result. Choreography: explain feature → power on → demonstrate → show result.

**Category affinity:** beauty tools, kitchen gadgets, tech devices, electronics

### 7. Before / After Reveal

> Split the video into clear before and after states. Problem segment: show the 'before' state (bare face, messy hair, stained surface). Solution segment: apply/use product. CTA segment: reveal the 'after' transformation.

**Category affinity:** skincare, haircare, cleaning, fitness (any product with visible results)

### 8. Pour / Drink

> Creator pours liquid product into glass or takes directly from bottle. Focuses on liquid color, consistency, pour sound (visual ASMR). Takes a drink, shows reaction. Props: clear glass, ice optional.

**Category affinity:** beverages, liquid supplements, protein shakes

### 9. Side-by-Side Compare

> Creator holds two items — product vs. competitor or product vs. previous version. Points out differences, shows labels. During hero segment: focuses on product advantages.

**Category affinity:** any (especially products with clear competitive advantage)

### 10. Set Down & Point

> Minimal interaction — product sits on surface, creator points to it, gestures toward it, picks it up briefly. Low-interaction format for when the talking-head delivery is the focus, not the product demo. The product is a visual anchor, not the action.

**Category affinity:** universal (especially info-heavy products where the script carries the sale)

---

## CastingAgent Prompt Integration

### Current Prompt (replaced)

```
Setting: ${setting}
```

### New Prompt

```
Scene: ${sceneDescription}
Product interaction: ${interactionDescription}

CONSISTENCY RULE: All 4 segments MUST use the same room, lighting setup, and props.
Only vary: character pose, energy level, product visibility, and camera micro-adjustments
(slight angle shift, subtle lighting warmth change matching energy arc).
The video must look like one continuous shoot in one location.
```

### Per-Segment Micro-Adjustments

The consistency rule allows the CastingAgent to make subtle per-segment variations while keeping the scene locked:

| Segment | Scene (LOCKED) | Micro-Adjustment Guidance |
|---------|---------------|--------------------------|
| Hook (HIGH energy) | Same room, same lighting | Slightly wider angle, subject leaning forward, bright catchlights |
| Problem (LOW→PEAK) | Same room, same lighting | Tighter framing, concerned expression, softer lighting warmth |
| Solution (HIGH→LOW) | Same room, same lighting | Medium shot, product interaction visible, confident posture |
| CTA (PEAK→LOW) | Same room, same lighting | Close-up, direct eye contact, warm friendly lighting |

---

## Influencer Selection UX

### Updated Flow: WHO → WHERE → HOW

The influencer selection page expands from one section to three:

1. **WHO** — Influencer picker (existing UI, unchanged)
2. **WHERE** — Scene preset selector (new)
3. **HOW** — Interaction preset selector (new)

### Scene Selector Component

- Card grid showing all scene presets
- Cards sorted by category affinity (best match for product category gets "★ Best match" badge)
- Clicking a card shows full description + virality notes below
- "+ Custom" button opens title + description form
- Custom presets saved to DB for reuse
- Default pre-selected: Bedroom Ring Light

### Interaction Selector Component

- Same card grid pattern as scene selector
- Sorted by category affinity
- "+ Custom" button for user-created interactions
- Default pre-selected: Hold & Show

### Existing Controls (Unchanged)

Product placement per-segment overrides (visibility: none/subtle/hero/set_down) remain below the new selectors. The user can still fine-tune per-segment product visibility independently of the interaction style.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/scene-presets` | List all scene presets. Optional `?category=` sorts by affinity. |
| `POST` | `/api/scene-presets` | Create custom: `{ title, description }`. Sets `is_custom=true`. |
| `DELETE` | `/api/scene-presets/[id]` | Delete custom preset. 409 if `is_custom=false`. |
| `GET` | `/api/interaction-presets` | List all interaction presets. Optional `?category=` sorts by affinity. |
| `POST` | `/api/interaction-presets` | Create custom: `{ title, description }`. Sets `is_custom=true`. |
| `DELETE` | `/api/interaction-presets/[id]` | Delete custom preset. 409 if `is_custom=false`. |

### Select-Influencer API Update

`POST /api/projects/[id]/select-influencer` updated to accept:

```typescript
{
  influencerId: string;
  scenePresetId?: string;
  sceneOverride?: string;
  interactionPresetId?: string;
  interactionOverride?: string;
}
```

Defaults to `is_default=true` presets if neither preset ID nor override provided.

---

## New Files

| File | Purpose |
|------|---------|
| `src/app/api/scene-presets/route.ts` | GET + POST for scene presets |
| `src/app/api/scene-presets/[id]/route.ts` | DELETE for custom scene presets |
| `src/app/api/interaction-presets/route.ts` | GET + POST for interaction presets |
| `src/app/api/interaction-presets/[id]/route.ts` | DELETE for custom interaction presets |
| `src/components/scene-selector.tsx` | Card grid for scene selection + custom form |
| `src/components/interaction-selector.tsx` | Card grid for interaction selection + custom form |

## Modified Files

| File | Changes |
|------|---------|
| `src/agents/casting-agent.ts` | Replace `Setting: ${setting}` with scene + interaction from project. Add consistency rule. Legacy fallback to `ai_character.setting`. |
| `src/app/api/projects/[id]/select-influencer/route.ts` | Accept scene + interaction selections, save to project. |
| `src/components/influencer-selection.tsx` | Add Scene Selector and Interaction Selector sections (WHO → WHERE → HOW). |

## Unchanged

- `PRODUCT_PLACEMENT_ARC` — per-segment visibility stays
- `ENERGY_ARC` — per-segment energy stays
- DirectorAgent — uses keyframes as before
- `ai_character.setting` — stays for legacy, deprioritized
- All other pipeline stages — no changes

---

## Acceptance Criteria

### Backend
- [ ] `scene_preset` table created via Supabase migration with 7 system presets seeded
- [ ] `interaction_preset` table created via Supabase migration with 10 system presets seeded
- [ ] `project` table: add `scene_preset_id`, `scene_override`, `interaction_preset_id`, `interaction_override` columns
- [ ] `GET /api/scene-presets` returns presets, sorted by category affinity when `?category=` provided
- [ ] `POST /api/scene-presets` creates custom preset with `is_custom=true`
- [ ] `DELETE /api/scene-presets/[id]` returns 409 for system presets
- [ ] Same CRUD for interaction presets
- [ ] `POST /api/projects/[id]/select-influencer` accepts and stores scene + interaction selections
- [ ] CastingAgent reads scene + interaction from project, combines into prompt
- [ ] CastingAgent includes consistency rule: "All 4 segments MUST use same room, lighting, props"
- [ ] CastingAgent falls back to `ai_character.setting` for old projects without scene preset
- [ ] Micro-adjustment guidance: per-segment energy arc shifts framing/warmth, not the room

### Frontend
- [ ] Scene Selector: card grid sorted by category affinity, "★ Best match" badge, description + virality notes on select, "+ Custom" form
- [ ] Interaction Selector: same card grid pattern, category sorting, custom form
- [ ] Both integrated into influencer selection page (WHO → WHERE → HOW layout)
- [ ] Defaults pre-selected (Bedroom Ring Light + Hold & Show)
- [ ] Custom presets saved to DB and reappear in future projects
- [ ] Existing product placement per-segment controls remain unchanged

### Data Integrity
- [ ] Old projects without `scene_preset_id` work (CastingAgent falls back to `ai_character.setting`)
- [ ] System presets immutable (cannot be deleted)
- [ ] Custom presets reusable across projects

---

## Parallel Work Analysis

```
PARALLEL WORK ANALYSIS:

- Task A (backend): scene_preset + interaction_preset tables, seed data, CRUD APIs
  Files: Supabase migration, src/app/api/scene-presets/**, src/app/api/interaction-presets/**
  Independent: YES (all new files)

- Task B (backend): Project columns + select-influencer API update + CastingAgent prompt rewrite
  Files: Supabase migration (project columns), src/app/api/projects/[id]/select-influencer/route.ts,
         src/agents/casting-agent.ts
  BLOCKED by Task A (needs preset tables for FK)

- Task C (frontend): Scene Selector + Interaction Selector + influencer selection integration
  Files: src/components/scene-selector.tsx (NEW), src/components/interaction-selector.tsx (NEW),
         src/components/influencer-selection.tsx
  BLOCKED by Task A (needs API to fetch presets)

Recommendation:
  Step 1: Task A (preset tables + seed data + CRUD APIs)
  Step 2: Task B + Task C in parallel (backend CastingAgent + frontend selectors — no shared files)
```
