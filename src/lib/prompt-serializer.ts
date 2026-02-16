// ─── Prompt Serializers ──────────────────────────────────────────────────────
// Convert StructuredPrompt JSON into API-ready strings for each generation target.

import { StructuredPrompt } from './prompt-schema';

// ─── Image Serializer (Nano Banana Pro) ──────────────────────────────────────

/**
 * Flattens a StructuredPrompt into descriptive prose for Nano Banana Pro
 * text-to-image or image-edit. Uses `++emphasis++` syntax for subject/product.
 */
export function serializeForImage(prompt: StructuredPrompt): string {
  const parts: string[] = [];

  // Subject with emphasis
  if (prompt.subject) {
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

/**
 * Extracts structured fields for Kling 3.0 Pro video generation.
 * Returns main prompt, multi-prompt timeline, and negative prompt.
 */
export function serializeForVideo(
  prompt: StructuredPrompt,
  shotDuration: string = '5',
): VideoPromptOutput {
  // Main prompt: environment + camera + style + dialogue delivery
  const mainParts: string[] = [];

  if (prompt.environment) {
    mainParts.push(prompt.environment.setting);
    if (prompt.environment.product_position) {
      mainParts.push(`Product: ${prompt.environment.product_position}`);
    }
  }

  if (prompt.camera_specs) {
    mainParts.push(`${prompt.camera_specs.shot}, ${prompt.camera_specs.movement}`);
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
  const multiPrompt = (prompt.action?.sequence || []).map((shot) => ({
    prompt: `${shot.action}. Energy: ${shot.energy}. Camera follows subject naturally.`,
    duration: shotDuration,
  }));

  return {
    prompt: mainPrompt,
    multiPrompt,
    negativePrompt: prompt.negative_prompt,
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
