# R1.5.17: Structured Prompt Schema for Asset Generation

**Author:** PM Agent
**Date:** 2026-02-16
**Status:** Spec Complete

---

## Problem

Asset generation prompts are inconsistent across agents:

- **CastingAgent** uses an LLM to write free-text image prompts — creative but unstructured, no guaranteed coverage of key fields (product visibility, lighting, negative prompt)
- **DirectorAgent** builds video prompts via string concatenation — generic ("Natural movement, professional lighting, TikTok style video"), weakest prompts in the pipeline
- **B-RollAgent** LLM outputs JSON with a single `prompt` string — no breakdown of scene/lighting/style components
- **Negative prompts** are 3 different hardcoded strings scattered across agents, none comprehensive
- No user visibility into or control over negative prompts

## Solution

Define a unified `StructuredPrompt` JSON schema optimized for Kling 3.0. All agents tell the LLM to output this schema. A shared serializer converts the structured JSON into API-ready strings per target (Nano Banana Pro for images, Kling 3.0 for video). Negative prompts are centralized and user-overridable.

---

## StructuredPrompt Schema

```typescript
interface StructuredPrompt {
  subject?: {
    primary: string;        // "Young woman with dark hair in high bun"
    emphasis?: string;      // "++Young woman with dark hair in high bun++" (Kling emphasis)
    features?: string;      // "blue eyes"
    wardrobe?: string;      // "white lab coat over white ribbed tank top, layered gold necklaces"
  };
  product?: {
    emphasis?: string;      // "++Large white NeoCell container with teal label++"
    position?: string;      // "on table, then picked up and held"
  };
  dialogue?: {
    text?: string;          // scene.script_text for the segment
    delivery?: string;      // "showcasing product with genuine enthusiasm"
  };
  action: {
    sequence: Array<{
      time: string;         // "0-5s" — derived from shot_scripts timing
      action: string;       // "calm and warm, reaches for product naturally"
      energy: string;       // "low-medium" — from energy_arc
    }>;
    energy_arc: string;     // "LOW → PEAK → LOW"
  };
  camera_specs: {
    shot: string;           // "close-up, head and shoulders"
    movement: string;       // "static, no camera movement"
    framing?: string;       // "subject centered, room for product showcase"
  };
  environment: {
    setting: string;        // from scene_preset description
    elements?: string[];    // ["bed softly blurred in background", "ring light visible"]
    product_visible: boolean;
    product_position?: string; // from product_placement_arc: "hero moment — held, label shown"
  };
  lighting: {
    type: string;           // "natural ring light only" — from scene_preset
    quality: string;        // "soft warm glow, slightly uneven home lighting"
    details?: string;       // "circular catchlights in eyes"
    avoid?: string;         // "studio lighting, production lighting, softbox"
  };
  style: {
    aesthetic: string;      // "authentic product review, genuine enthusiasm"
    quality: string;        // "1080p" — from video model
    skin?: string;          // "natural texture"
  };
  negative_prompt: string;  // standardized per video model, user-overridable
}
```

### Data Source Mapping

| Schema field | Source |
|-------------|--------|
| `subject.primary/features/wardrobe` | influencer persona + character appearance |
| `product.emphasis/position` | product data + `PRODUCT_PLACEMENT_ARC[segIdx]` |
| `dialogue.text` | `scene.script_text` |
| `dialogue.delivery` | LLM-generated from energy arc + section context |
| `action.sequence` | `scene.shot_scripts` (3 shots x 5s) |
| `action.energy_arc` | `ENERGY_ARC[segIdx]` |
| `camera_specs` | `scene.camera_specs` or defaults |
| `environment.setting` | `scene_preset.description` |
| `environment.elements` | `scene_preset` details or SEAL data |
| `environment.product_visible/position` | `PRODUCT_PLACEMENT_ARC[segIdx]` |
| `lighting` | `scene_preset` lighting details or SEAL data |
| `style.quality` | video model resolution (`1080p`) |
| `negative_prompt` | model default or project override |

### Usage by Agent

| Agent | Fields used | Unused fields |
|-------|------------|---------------|
| CastingAgent (keyframes) | All fields | — |
| DirectorAgent (video) | action, camera_specs, environment, dialogue, style, negative_prompt | subject (already in keyframe image) |
| B-RollAgent (images) | environment, lighting, style, product, negative_prompt | subject, dialogue (cutaway shots, no person) |

---

## LLM Integration

### CastingAgent

Changes LLM system prompt from "output `{start: string, end: string}`" to "output `{start: StructuredPrompt, end: StructuredPrompt}`". User prompt still feeds all context (appearance, wardrobe, scene preset, energy arc, product placement, SEAL data). LLM returns two structured JSON objects instead of free-text prose.

```
LLM Input:  scene data + character + presets + SEAL data (same as today)
LLM Output: { start: StructuredPrompt, end: StructuredPrompt }
Storage:    scene.visual_prompt = { start: StructuredPrompt, end: StructuredPrompt }
API call:   serializeForImage(prompt.start) → wavespeed.generateImage() or editImage()
```

### DirectorAgent

Gains an LLM step (currently has none — uses string concatenation). The LLM generates a StructuredPrompt per segment, replacing the generic "Natural movement, professional lighting" strings. Cost: $0.01/segment x 4 = $0.04/video.

```
LLM Input:  scene data + shot_scripts + energy arc + camera specs
LLM Output: StructuredPrompt
API call:   serializeForVideo(prompt) → { prompt, multiPrompt, negativePrompt } → wavespeed.generateVideo()
```

### B-RollAgent

Planning LLM already outputs JSON. Change its output schema to include StructuredPrompt fields (environment, lighting, style) instead of a single `prompt` string.

```
LLM Input:  product data + script segments + broll presets (same as today)
LLM Output: Array<{ ...brollMetadata, prompt: StructuredPrompt }>
Storage:    broll_shot.prompt stores StructuredPrompt JSON
API call:   serializeForBroll(shot.prompt) → wavespeed.generateImage()
```

---

## Prompt Serializer

New shared module: `src/lib/prompt-serializer.ts`

### `serializeForImage(prompt: StructuredPrompt): string`

Flattens to descriptive prose for Nano Banana Pro text-to-image:

```
"++Young woman with dark hair in high bun++, blue eyes, wearing white lab coat
over white ribbed tank top, layered gold coin necklaces. In bedroom with bed
softly blurred in background, ring light visible. ++Large white NeoCell supplement
container with teal label++, hero moment — picked up, held, label shown. Natural
ring light only, soft warm glow, circular catchlights in eyes. Authentic product
review, genuine enthusiasm. 1080p, natural texture.
Negative: camera movement, zoom, pan, tilt, ..."
```

### `serializeForVideo(prompt: StructuredPrompt): VideoPromptOutput`

Returns structured output for Kling 3.0 Pro:

```typescript
interface VideoPromptOutput {
  prompt: string;           // Main scene description from environment + camera + style
  multiPrompt: Array<{      // From action.sequence
    prompt: string;
    duration: string;
  }>;
  negativePrompt: string;   // From negative_prompt field
}
```

### `serializeForBroll(prompt: StructuredPrompt): string`

Flattens environment + lighting + style + product fields only (no subject/dialogue — cutaway shots don't show the person).

---

## Negative Prompt System

### Centralized Default

One Kling-optimized negative prompt constant replaces the 3 scattered strings:

```typescript
const KLING_NEGATIVE_PROMPT = "camera movement, zoom, pan, tilt, tracking shot, handheld shake, dolly movement, crane movement, static expression, robotic movement, unnatural lip sync, dead air, long pauses, blurry, distorted face, studio lighting, production lighting, softbox, professional lighting setup, watermark, text overlay, logo, low quality";
```

### User Override

**Schema:** Add `negative_prompt_override` JSONB column to `project` table (nullable):

```typescript
// null = use model default everywhere
// string = global override for all stages
// object = per-stage overrides
type NegativePromptOverride = string | {
  casting?: string;
  directing?: string;
  broll?: string;
} | null;
```

**UI at generation gates (casting approve, video generation, B-roll approve):**

- **Info icon** (tooltip/popover) shows the current negative prompt that will be used
- **"Customize" toggle** expands an editable text field pre-filled with the model default
- **"Reset to default" button** clears the override
- Saved via `PATCH /api/projects/[id]` with `negative_prompt_override`

**Agent resolution:**

```
project.negative_prompt_override?.[stage]
  ?? project.negative_prompt_override (if string)
  ?? KLING_NEGATIVE_PROMPT (model default)
```

---

## Storage & Backward Compatibility

**`scene.visual_prompt`** (existing JSONB column):

- **Before:** `{ start: string, end: string }` — free-text prompts
- **After:** `{ start: StructuredPrompt, end: StructuredPrompt }` — structured JSON

**Backward compatibility:** The serializer detects whether `visual_prompt.start` is a string (old format) or an object (new format). Old projects use the string directly. New projects use the serializer. No migration of existing data needed.

**Regeneration:** Pipeline worker reads stored `scene.visual_prompt`, detects format, routes through serializer if structured or passes through if legacy string.

---

## Cost Impact

DirectorAgent gains an LLM call: $0.01/segment x 4 = $0.04/video.
Total per-video cost: ~$5.58 → ~$5.62. Marginal.

---

## Acceptance Criteria

### Schema & Serializer
- [ ] `StructuredPrompt` interface defined in `src/lib/prompt-schema.ts`
- [ ] `KLING_NEGATIVE_PROMPT` constant with comprehensive Kling-optimized terms
- [ ] `serializeForImage()` flattens StructuredPrompt → descriptive prose for Nano Banana Pro
- [ ] `serializeForVideo()` extracts prompt + multiPrompt + negativePrompt for Kling 3.0
- [ ] `serializeForBroll()` flattens environment/lighting/style fields for cutaway images

### Agent Integration
- [ ] CastingAgent LLM outputs `{start: StructuredPrompt, end: StructuredPrompt}`
- [ ] DirectorAgent uses LLM to generate StructuredPrompt per segment (replaces string concatenation)
- [ ] B-RollAgent planning LLM outputs StructuredPrompt fields per shot
- [ ] `scene.visual_prompt` stores structured JSON (backward compat with old string format)
- [ ] Pipeline worker regeneration reads stored structured JSON + serializer
- [ ] All scattered `NEGATIVE_PROMPT` strings removed, replaced with centralized constant

### Negative Prompt UI
- [ ] `negative_prompt_override` JSONB column added to `project` table
- [ ] Info icon shows default negative prompt at all generation gates (casting, directing, B-roll)
- [ ] Override toggle: editable text field pre-filled with default, "Reset to default" button
- [ ] Agents read project override before falling back to model default

### Quality Gates
- [ ] `npm run build` passes
- [ ] Existing projects with old `visual_prompt` string format continue working

---

## Affected Files

**New:**
- `src/lib/prompt-schema.ts` — StructuredPrompt interface + KLING_NEGATIVE_PROMPT constant
- `src/lib/prompt-serializer.ts` — serializeForImage(), serializeForVideo(), serializeForBroll()

**Backend (modify):**
- `src/agents/casting-agent.ts` — LLM system prompt → structured JSON output, serialize before API call
- `src/agents/director-agent.ts` — Add LLM step, replace string concatenation with structured prompt + serializer
- `src/agents/broll-agent.ts` — Align planning LLM output with StructuredPrompt fields, serialize for generation
- `src/workers/pipeline.worker.ts` — Regeneration handlers use stored structured JSON + serializer
- `src/lib/constants.ts` — Remove scattered NEGATIVE_PROMPT strings
- `src/app/api/projects/[id]/route.ts` — PATCH accepts negative_prompt_override
- `src/db/schema.ts` — Document negative_prompt_override column

**Frontend (modify):**
- `src/components/project-detail.tsx` — Negative prompt info icon + override UI at generation gates

**Migration:**
- Add `negative_prompt_override` JSONB column to `project` table

## PARALLEL WORK ANALYSIS

```
- Task A (schema + serializer): Independent, start immediately
  Files: src/lib/prompt-schema.ts, src/lib/prompt-serializer.ts
  Scope: Interface, constant, 3 serializer functions

- Task B (agent refactor): Depends on Task A (imports schema + serializer)
  Files: casting-agent.ts, director-agent.ts, broll-agent.ts, pipeline.worker.ts, constants.ts
  Scope: All 3 agents + worker regeneration handlers

- Task C (migration + API): Independent of A/B
  Files: project route PATCH, schema.ts doc
  Scope: Add negative_prompt_override column, accept in PATCH

- Task D (frontend): Depends on Task C (needs override field in API)
  Files: project-detail.tsx
  Scope: Info icon, override toggle, reset button at generation gates

Recommendation: Backend agent handles A + B + C sequentially (shared files).
Frontend agent handles D after backend confirms API returns negative_prompt_override.
```
