// ─── Prompt Serializers ──────────────────────────────────────────────────────
// Convert StructuredPrompt JSON into API-ready strings for each generation target.

import { StructuredPrompt } from './prompt-schema';

// ─── Image Serializer (Nano Banana Pro) ──────────────────────────────────────

/**
 * Flattens a StructuredPrompt into descriptive prose for Nano Banana Pro
 * text-to-image or image-edit. Uses `++emphasis++` syntax for subject/product.
 */
export function serializeForImage(
  prompt: StructuredPrompt,
  opts?: { skipSubject?: boolean },
): string {
  const parts: string[] = [];

  // Subject — skip when a reference image defines the person's appearance
  if (prompt.subject && !opts?.skipSubject) {
    parts.push(prompt.subject.emphasis || prompt.subject.primary);
    if (prompt.subject.features) parts.push(prompt.subject.features);
    if (prompt.subject.wardrobe) parts.push(`wearing ${prompt.subject.wardrobe}`);
  }

  // Environment
  if (prompt.environment) {
    parts.push(prompt.environment.setting);
    if (prompt.environment.elements?.length) {
      parts.push(prompt.environment.elements.join(', '));
    }
  }

  // Product with emphasis
  if (prompt.product) {
    const productParts: string[] = [];
    if (prompt.product.emphasis) productParts.push(prompt.product.emphasis);
    if (prompt.product.scale) productParts.push(prompt.product.scale);
    if (prompt.product.position) productParts.push(prompt.product.position);
    if (productParts.length) parts.push(productParts.join(', '));
  }

  // Action (first sequence item for single-frame context)
  if (prompt.action?.sequence?.length) {
    const first = prompt.action.sequence[0];
    parts.push(first.action);
  }

  // Lighting
  if (prompt.lighting) {
    parts.push(`${prompt.lighting.type}, ${prompt.lighting.quality}`);
    if (prompt.lighting.details) parts.push(prompt.lighting.details);
  }

  // Camera
  if (prompt.camera_specs) {
    parts.push(`${prompt.camera_specs.shot}, ${prompt.camera_specs.movement}`);
    if (prompt.camera_specs.framing) parts.push(prompt.camera_specs.framing);
  }

  // Style
  if (prompt.style) {
    parts.push(prompt.style.aesthetic);
    parts.push(prompt.style.quality);
    if (prompt.style.skin) parts.push(prompt.style.skin);
  }

  return parts.filter(Boolean).join('. ') + '.';
}

// ─── Video Serializer (Kling 3.0 Pro) ───────────────────────────────────────

export interface VideoPromptOutput {
  prompt: string;
  multiPrompt: Array<{ prompt: string; duration: string }>;
  negativePrompt: string;
}

export interface SerializeVideoOptions {
  shotDuration?: string;
  lockCamera?: boolean;
}

/**
 * Extracts structured fields for Kling 3.0 Pro video generation.
 * Returns main prompt, multi-prompt timeline, and negative prompt.
 * When lockCamera is true, overrides camera movement to static and adds
 * camera movement terms to the negative prompt.
 */
export function serializeForVideo(
  prompt: StructuredPrompt,
  shotDurationOrOpts: string | SerializeVideoOptions = '5',
): VideoPromptOutput {
  // Support both legacy string arg and new options object
  const opts = typeof shotDurationOrOpts === 'string'
    ? { shotDuration: shotDurationOrOpts, lockCamera: false }
    : { shotDuration: shotDurationOrOpts.shotDuration ?? '5', lockCamera: shotDurationOrOpts.lockCamera ?? false };

  // Main prompt: environment + camera + style + dialogue delivery
  const mainParts: string[] = [];

  if (prompt.environment) {
    mainParts.push(prompt.environment.setting);
    if (prompt.environment.product_position) {
      const scaleNote = prompt.product?.scale ? ` (${prompt.product.scale})` : '';
      mainParts.push(`Product: ${prompt.environment.product_position}${scaleNote}`);
    }
  }

  if (prompt.camera_specs) {
    if (opts.lockCamera) {
      mainParts.push(`${prompt.camera_specs.shot}, static locked camera, no camera movement`);
    } else {
      mainParts.push(`${prompt.camera_specs.shot}, ${prompt.camera_specs.movement}`);
    }
  } else if (opts.lockCamera) {
    mainParts.push('static locked camera, no camera movement');
  }

  if (prompt.dialogue?.text) {
    mainParts.push(`Speaking: "${prompt.dialogue.text}"`);
  }
  if (prompt.dialogue?.delivery) {
    mainParts.push(prompt.dialogue.delivery);
  }

  if (prompt.lighting) {
    mainParts.push(`${prompt.lighting.type}, ${prompt.lighting.quality}`);
  }

  if (prompt.style) {
    mainParts.push(`${prompt.style.aesthetic}, ${prompt.style.quality}`);
  }

  const mainPrompt = mainParts.filter(Boolean).join('. ') + '.';

  // Multi-prompt: from action sequence
  const cameraNote = opts.lockCamera ? 'Static locked camera.' : 'Camera follows subject naturally.';
  const multiPrompt = (prompt.action?.sequence || []).map((shot) => ({
    prompt: `${shot.action}. Energy: ${shot.energy}. ${cameraNote}`,
    duration: opts.shotDuration,
  }));

  // Negative prompt: append camera movement terms when locked
  let negativePrompt = prompt.negative_prompt;
  if (opts.lockCamera && negativePrompt) {
    negativePrompt += ', camera movement, camera shake, camera pan, camera zoom, camera tilt';
  } else if (opts.lockCamera) {
    negativePrompt = 'camera movement, camera shake, camera pan, camera zoom, camera tilt';
  }

  return {
    prompt: mainPrompt,
    multiPrompt,
    negativePrompt,
  };
}

// ─── B-Roll Serializer ──────────────────────────────────────────────────────

/**
 * Flattens environment + lighting + style + product fields for cutaway images.
 * No subject or dialogue — B-roll shots don't show the person.
 */
export function serializeForBroll(prompt: StructuredPrompt): string {
  const parts: string[] = [];

  if (prompt.environment) {
    parts.push(prompt.environment.setting);
    if (prompt.environment.elements?.length) {
      parts.push(prompt.environment.elements.join(', '));
    }
  }

  if (prompt.product) {
    if (prompt.product.emphasis) parts.push(prompt.product.emphasis);
    if (prompt.product.scale) parts.push(prompt.product.scale);
    if (prompt.product.position) parts.push(prompt.product.position);
  }

  if (prompt.lighting) {
    parts.push(`${prompt.lighting.type}, ${prompt.lighting.quality}`);
  }

  if (prompt.style) {
    parts.push(prompt.style.aesthetic);
    parts.push(prompt.style.quality);
  }

  return parts.filter(Boolean).join('. ') + '. Photorealistic, 9:16 vertical.';
}
