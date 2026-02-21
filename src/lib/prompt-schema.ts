// ─── Structured Prompt Schema ────────────────────────────────────────────────
// Unified JSON schema for all asset generation prompts (keyframes, video, b-roll).
// Agents instruct the LLM to output this schema; serializers flatten it for each API target.

export interface StructuredPrompt {
  subject?: {
    primary: string;
    emphasis?: string;
    features?: string;
    wardrobe?: string;
  };
  product?: {
    emphasis?: string;
    position?: string;
    scale?: string;
  };
  dialogue?: {
    text?: string;
    delivery?: string;
  };
  action: {
    sequence: Array<{
      time: string;
      action: string;
      energy: string;
    }>;
    energy_arc: string;
  };
  camera_specs: {
    shot: string;
    movement: string;
    framing?: string;
  };
  environment: {
    setting: string;
    elements?: string[];
    product_visible: boolean;
    product_position?: string;
  };
  lighting: {
    type: string;
    quality: string;
    details?: string;
    avoid?: string;
  };
  style: {
    aesthetic: string;
    quality: string;
    skin?: string;
  };
  negative_prompt: string;
}

// ─── Centralized Negative Prompts ────────────────────────────────────────────

/** Comprehensive Kling 3.0 Pro-optimized negative prompt for VIDEO generation. */
export const KLING_NEGATIVE_PROMPT =
  'camera movement, zoom, pan, tilt, tracking shot, handheld shake, dolly movement, crane movement, ' +
  'static expression, robotic movement, unnatural lip sync, dead air, long pauses, ' +
  'blurry, distorted face, deformed, ugly, duplicate, extra limbs, poorly drawn, ' +
  'studio lighting, production lighting, softbox, professional lighting setup, ' +
  'watermark, text overlay, logo, low quality, flickering, frozen';

/** Image-specific negative prompt for Nano Banana Pro (no camera motion terms). */
export const IMAGE_NEGATIVE_PROMPT =
  'blurry, distorted face, deformed, ugly, duplicate, extra limbs, poorly drawn, ' +
  'studio lighting, production lighting, softbox, professional lighting setup, ' +
  'watermark, text, logo, low quality';

// ─── Negative Prompt Resolution ──────────────────────────────────────────────

type NegativePromptStage = 'casting' | 'directing' | 'broll';

/**
 * Resolves the effective negative prompt for a given stage.
 * Priority: project per-stage override → project global override → model default.
 */
export function resolveNegativePrompt(
  project: { negative_prompt_override?: unknown } | null,
  stage: NegativePromptStage,
): string {
  const override = project?.negative_prompt_override;
  if (!override) {
    return stage === 'directing' ? KLING_NEGATIVE_PROMPT : IMAGE_NEGATIVE_PROMPT;
  }

  // String override → global for all stages
  if (typeof override === 'string') return override;

  // Object override → per-stage
  if (typeof override === 'object' && override !== null) {
    const perStage = (override as Record<string, string>)[stage];
    if (typeof perStage === 'string') return perStage;
  }

  // Fallback to model default
  return stage === 'directing' ? KLING_NEGATIVE_PROMPT : IMAGE_NEGATIVE_PROMPT;
}

// ─── Type Guard ──────────────────────────────────────────────────────────────

/**
 * Detects whether a stored visual prompt value is a StructuredPrompt (new format)
 * or a legacy plain string. Used for backward compatibility in the pipeline worker
 * and regeneration handlers.
 */
export function isStructuredPrompt(value: unknown): value is StructuredPrompt {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  // StructuredPrompt always has `action` as an object with `sequence`
  return (
    typeof obj.action === 'object' &&
    obj.action !== null &&
    Array.isArray((obj.action as Record<string, unknown>).sequence)
  );
}

/** JSON schema description string for embedding in LLM system prompts. */
export const STRUCTURED_PROMPT_SCHEMA_DESCRIPTION = `Output a JSON object matching this schema:
{
  "subject": {
    "primary": "character description",
    "emphasis": "++emphasized subject description++",
    "features": "eye color, distinguishing features",
    "wardrobe": "clothing description"
  },
  "product": {
    "emphasis": "++product description with emphasis++",
    "position": "where/how product appears",
    "scale": "realistic relative size vs subject (e.g. palm-sized bottle, forearm-height container)"
  },
  "dialogue": {
    "text": "what is being said",
    "delivery": "how it is delivered"
  },
  "action": {
    "sequence": [
      { "time": "0-5s", "action": "description of action", "energy": "LOW" }
    ],
    "energy_arc": "LOW → PEAK → LOW"
  },
  "camera_specs": {
    "shot": "close-up, medium, wide",
    "movement": "static, slow zoom in",
    "framing": "subject centered, rule of thirds"
  },
  "environment": {
    "setting": "location description",
    "elements": ["background detail 1", "background detail 2"],
    "product_visible": true,
    "product_position": "on table, held up"
  },
  "lighting": {
    "type": "natural ring light, window light",
    "quality": "soft warm glow",
    "details": "circular catchlights in eyes",
    "avoid": "studio lighting, softbox"
  },
  "style": {
    "aesthetic": "authentic product review",
    "quality": "1080p",
    "skin": "natural texture"
  },
  "negative_prompt": "standard negative prompt string"
}`;
