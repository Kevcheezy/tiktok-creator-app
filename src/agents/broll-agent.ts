import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import {
  API_COSTS,
  RESOLUTION,
  BROLL_PRESETS,
  BROLL_NARRATIVE_ARC,
  calculateBrollCount,
  pickKenBurnsDirection,
  type BrollPreset,
} from '@/lib/constants';
import { IMAGE_NEGATIVE_PROMPT, resolveNegativePrompt, isStructuredPrompt } from '@/lib/prompt-schema';
import { serializeForBroll } from '@/lib/prompt-serializer';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BrollCue {
  shot_script_index: number;
  offset_seconds: number;
  duration_seconds: number;
  intent: string;
  spoken_text_during: string;
}

interface BrollShotFromLLM {
  segment_index: number;
  shot_index: number;
  category: string;
  prompt: string;
  structured_prompt?: Record<string, unknown>;
  narrative_role: string;
  timing_seconds: number;
  duration_seconds: number;
}

// ─── B-Roll Agent ───────────────────────────────────────────────────────────────

export class BRollAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('BRollAgent', supabaseClient);
  }

  async run(projectId: string): Promise<void> {
    // BRollAgent has two phases; run() dispatches to plan() by default
    // generate() is called separately from the pipeline worker
    await this.plan(projectId);
  }

  // ─── Phase 1: Planning ─────────────────────────────────────────────────────

  async plan(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'broll_planning');
    this.log(`Starting B-roll planning for project ${projectId}`);

    // 1. Fetch project with product data
    const { data: proj, error: projError } = await this.supabase
      .from('project')
      .select('*, product:product(*), negative_prompt_override')
      .eq('id', projectId)
      .single();

    if (projError || !proj) throw new Error(`Project not found: ${projectId}`);

    const productData = proj.product_data as {
      product_name: string;
      category: string;
      selling_points?: string[];
    } | null;

    if (!productData) throw new Error(`Project ${projectId} has no product_data`);

    const category = productData.category || 'supplements';
    const preset = BROLL_PRESETS[category] || BROLL_PRESETS.supplements;

    // 2. Fetch the latest script and its scenes
    const { data: scripts } = await this.supabase
      .from('script')
      .select('id')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    if (!scripts || scripts.length === 0) throw new Error('No script found for B-roll planning');
    const scriptId = scripts[0].id;

    const { data: scenes, error: scenesError } = await this.supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .order('segment_index');

    if (scenesError || !scenes || scenes.length === 0) {
      throw new Error(`No scenes found for script ${scriptId}`);
    }

    // Deduplicate: keep latest version per segment
    const scenesMap = new Map<number, typeof scenes[0]>();
    for (const s of scenes) {
      const existing = scenesMap.get(s.segment_index);
      if (!existing || (s.version ?? 1) > (existing.version ?? 1)) {
        scenesMap.set(s.segment_index, s);
      }
    }
    const latestScenes = Array.from(scenesMap.values()).sort((a, b) => a.segment_index - b.segment_index);

    // 3. Calculate shot counts per segment
    const segmentShotCounts = latestScenes.map((scene) => ({
      segmentIndex: scene.segment_index,
      syllables: scene.syllable_count || 85,
      shotCount: calculateBrollCount(scene.syllable_count || 85),
    }));

    const totalShots = segmentShotCounts.reduce((sum, s) => sum + s.shotCount, 0);
    this.log(`B-roll shot counts: ${segmentShotCounts.map(s => `seg${s.segmentIndex}=${s.shotCount}`).join(', ')} (total: ${totalShots})`);

    // 4. Build LLM prompt
    const systemPrompt = this.buildPlanningSystemPrompt();
    const userPrompt = this.buildPlanningUserPrompt(
      productData,
      proj.product?.image_url || proj.product_image_url,
      latestScenes,
      segmentShotCounts,
      preset,
      category,
    );

    // 5. Call LLM
    this.log('Calling LLM for B-roll shot list...');
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(systemPrompt, userPrompt, {
        temperature: 0.7,
        maxTokens: 8192,
      });
    } catch (err) {
      throw new Error(`B-roll planning LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. Parse response with repair + retry pipeline
    let shots: BrollShotFromLLM[];
    const parseResult = this.tryParseShots(rawResponse);

    if (parseResult.ok) {
      shots = parseResult.shots;
    } else {
      // Repair failed — log full raw response for debugging
      this.log('JSON parse failed after repair attempt, logging full response and retrying LLM', {
        projectId,
        parseError: parseResult.error,
        rawResponseLength: rawResponse.length,
      });
      await this.logEvent(projectId, 'json_parse_failure', 'broll_planning', {
        error: parseResult.error,
        rawResponse,
        rawResponseLength: rawResponse.length,
        attempt: 'initial',
      });

      // Retry LLM call once with strict formatting instructions
      this.log('Retrying LLM call with strict JSON formatting instructions...');
      let retryResponse: string;
      try {
        const strictSystemPrompt = systemPrompt
          + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no comments, no trailing commas. '
          + 'Do not wrap the response in ```json code fences. Output raw JSON only.';
        retryResponse = await this.wavespeed.chatCompletion(strictSystemPrompt, userPrompt, {
          temperature: 0.3,
          maxTokens: 8192,
        });
      } catch (err) {
        throw new Error(`B-roll planning LLM retry call failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Track cost for the retry call
      await this.trackCost(projectId, API_COSTS.brollPlanning);

      const retryResult = this.tryParseShots(retryResponse);
      if (retryResult.ok) {
        shots = retryResult.shots;
        this.log('LLM retry succeeded — parsed B-roll shots from retry response');
      } else {
        // Both attempts exhausted — log retry response and fail
        await this.logEvent(projectId, 'json_parse_failure', 'broll_planning', {
          error: retryResult.error,
          rawResponse: retryResponse,
          rawResponseLength: retryResponse.length,
          attempt: 'retry',
        });
        throw new Error(
          `Failed to parse B-roll LLM response after repair + retry. `
          + `Initial error: ${parseResult.error}. `
          + `Retry error: ${retryResult.error}. `
          + `Full responses logged to generation_log.`
        );
      }
    }

    this.log(`LLM returned ${shots.length} B-roll shots`);

    // 7. Save shots to broll_shot table
    const shotRows = shots.map((shot) => ({
      project_id: projectId,
      script_id: scriptId,
      segment_index: shot.segment_index,
      shot_index: shot.shot_index,
      category: shot.category,
      prompt: shot.prompt,
      narrative_role: shot.narrative_role || '',
      timing_seconds: shot.timing_seconds,
      duration_seconds: shot.duration_seconds || 2.5,
      source: 'ai_generated',
      status: 'planned',
      metadata: shot.structured_prompt ? { structured_prompt: shot.structured_prompt } : {},
    }));

    const { error: insertError } = await this.supabase
      .from('broll_shot')
      .insert(shotRows);

    if (insertError) throw new Error(`Failed to save B-roll shots: ${insertError.message}`);

    // 8. Track cost
    await this.trackCost(projectId, API_COSTS.brollPlanning);

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'broll_planning', {
      durationMs,
      totalShots: shots.length,
    });
    this.log(`B-roll planning complete: ${shots.length} shots planned for project ${projectId}`);
  }

  // ─── Phase 2: Generation ───────────────────────────────────────────────────

  async generate(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'broll_generation');
    this.log(`Starting B-roll generation for project ${projectId}`);

    // 1. Fetch all planned shots that need generation
    const { data: shots, error } = await this.supabase
      .from('broll_shot')
      .select('*')
      .eq('project_id', projectId)
      .eq('source', 'ai_generated')
      .in('status', ['planned', 'failed'])
      .order('segment_index')
      .order('shot_index');

    if (error) throw new Error(`Failed to fetch B-roll shots: ${error.message}`);
    if (!shots || shots.length === 0) {
      this.log('No B-roll shots to generate (all user-uploaded or already completed)');
      const durationMs = Date.now() - stageStart;
      await this.logEvent(projectId, 'stage_complete', 'broll_generation', { durationMs, generated: 0 });
      return;
    }

    this.log(`Generating ${shots.length} B-roll images...`);

    let completedCount = 0;
    let failedCount = 0;

    // 2. Generate each shot with per-shot error handling
    for (const shot of shots) {
      try {
        // Mark as generating
        await this.supabase
          .from('broll_shot')
          .update({ status: 'generating', updated_at: new Date().toISOString() })
          .eq('id', shot.id);

        // Generate image via Nano Banana Pro
        // Use structured prompt from metadata if available, otherwise use text prompt
        const shotMeta = (shot.metadata || {}) as Record<string, unknown>;
        const structuredPromptData = shotMeta.structured_prompt;
        const effectivePrompt = isStructuredPrompt(structuredPromptData)
          ? serializeForBroll(structuredPromptData)
          : shot.prompt;

        const imgOpts = {
          aspectRatio: RESOLUTION.aspectRatio,
          width: RESOLUTION.width,
          height: RESOLUTION.height,
        };
        const { taskId } = await this.wavespeed.generateImage(effectivePrompt, imgOpts);

        this.log(`Shot ${shot.segment_index}:${shot.shot_index} — polling task ${taskId}`);
        const result = await this.wavespeed.pollResult(taskId, {
          maxWait: 120000,
          initialInterval: 5000,
        });

        // Create asset record
        const { data: assetRecord } = await this.supabase
          .from('asset')
          .insert({
            project_id: projectId,
            type: 'broll',
            url: result.url || '',
            provider: 'wavespeed',
            provider_task_id: taskId,
            status: 'completed',
            cost_usd: API_COSTS.nanoBananaPro,
            metadata: {
              segment_index: shot.segment_index,
              shot_index: shot.shot_index,
              category: shot.category,
              timing_seconds: shot.timing_seconds,
              duration_seconds: shot.duration_seconds,
              ken_burns_direction: pickKenBurnsDirection(shot.shot_index),
            },
          })
          .select()
          .single();

        // Update broll_shot with image URL and asset link
        await this.supabase
          .from('broll_shot')
          .update({
            image_url: result.url || '',
            status: 'completed',
            asset_id: assetRecord?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shot.id);

        await this.trackCost(projectId, API_COSTS.nanoBananaPro);
        completedCount++;
        this.log(`Shot ${shot.segment_index}:${shot.shot_index} completed: ${result.url}`);
      } catch (err) {
        failedCount++;
        this.log(`Shot ${shot.segment_index}:${shot.shot_index} failed: ${err instanceof Error ? err.message : String(err)}`);

        await this.supabase
          .from('broll_shot')
          .update({
            status: 'failed',
            metadata: {
              ...((shot.metadata as Record<string, unknown>) || {}),
              error: err instanceof Error ? err.message : String(err),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', shot.id);

        // Create failed asset record for visibility
        await this.supabase.from('asset').insert({
          project_id: projectId,
          type: 'broll',
          status: 'failed',
          provider: 'wavespeed',
          cost_usd: 0,
          metadata: {
            segment_index: shot.segment_index,
            shot_index: shot.shot_index,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    // 3. Fail the stage only if ALL shots failed
    if (completedCount === 0 && failedCount > 0) {
      throw new Error(`All ${failedCount} B-roll shots failed to generate`);
    }

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'broll_generation', {
      durationMs,
      completed: completedCount,
      failed: failedCount,
      total: shots.length,
    });
    this.log(`B-roll generation complete: ${completedCount}/${shots.length} images generated (${failedCount} failed)`);
  }

  // ─── JSON Parse + Repair ───────────────────────────────────────────────────

  /**
   * Attempt to parse the LLM response into a BrollShotFromLLM array.
   * First tries raw JSON.parse, then applies string-based repair if that fails.
   */
  private tryParseShots(
    raw: string
  ): { ok: true; shots: BrollShotFromLLM[] } | { ok: false; error: string } {
    // Step 1: Strip markdown code fences
    let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Step 2: Try direct parse
    try {
      const parsed = JSON.parse(cleaned);
      const shots: BrollShotFromLLM[] = Array.isArray(parsed)
        ? parsed
        : parsed.shots || parsed.broll_shots || [];
      return { ok: true, shots };
    } catch {
      // Direct parse failed — proceed to repair
    }

    // Step 3: Apply string-based JSON repair
    const repaired = this.repairJson(cleaned);

    try {
      const parsed = JSON.parse(repaired);
      const shots: BrollShotFromLLM[] = Array.isArray(parsed)
        ? parsed
        : parsed.shots || parsed.broll_shots || [];
      this.log('JSON repair succeeded — parsed B-roll shots from repaired response');
      return { ok: true, shots };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Lightweight string-based JSON repair for common LLM malformations.
   * - Strips trailing commas before } and ]
   * - Attempts to close unclosed brackets and strings
   * - Removes single-line // comments
   */
  private repairJson(input: string): string {
    let s = input;

    // Remove single-line comments (// ...) that aren't inside strings
    // Simple heuristic: remove lines that start with // after trimming
    s = s.replace(/^\s*\/\/.*$/gm, '');

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([\]}])/g, '$1');

    // Try to fix truncated responses by closing unclosed brackets
    let openBrackets = 0;
    let openBraces = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
      else if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
    }

    // If we ended inside a string, close it
    if (inString) {
      s += '"';
    }

    // Close any unclosed braces, then brackets
    while (openBraces > 0) {
      s += '}';
      openBraces--;
    }
    while (openBrackets > 0) {
      s += ']';
      openBrackets--;
    }

    // One more pass: trailing commas may have been introduced by closing brackets
    s = s.replace(/,\s*([\]}])/g, '$1');

    return s;
  }

  // ─── LLM Prompt Builders ───────────────────────────────────────────────────

  private buildPlanningSystemPrompt(): string {
    return `You are a TikTok content strategist specializing in B-roll planning for short-form product videos. Your job is to create a B-roll shot list that maximizes viewer retention and conversion.

RULES:
1. Every B-roll image must be photorealistic with static camera, 9:16 vertical aspect ratio
2. B-roll inserts should create visual variety every 2-3 seconds
3. Each shot must have a clear narrative_role explaining how it strengthens the persuasion
4. Follow the narrative arc: contrast in hook, evidence in problem, proof in solution, aspiration in CTA
5. Never obscure the product in segments where product_visibility is 'hero' or 'set_down'
6. Transformation shots must show subtle, believable improvements (no dramatic/fake changes)
7. Research shots must look authentic (real papers, real annotations, real lighting)
8. Include specific details in prompts (lighting, surface, props, angle)

OUTPUT: JSON array of B-roll shots (no wrapping object, just the array):
[
  {
    "segment_index": 0,
    "shot_index": 0,
    "category": "social_proof",
    "prompt": "detailed photorealistic image generation prompt, 9:16 vertical",
    "structured_prompt": {
      "environment": { "setting": "location", "elements": ["detail1"], "product_visible": false },
      "lighting": { "type": "natural", "quality": "soft warm glow" },
      "style": { "aesthetic": "authentic product review", "quality": "1080p" },
      "product": { "emphasis": "product description if visible" }
    },
    "narrative_role": "why this shot strengthens the argument",
    "timing_seconds": 1.0,
    "duration_seconds": 2.5
  }
]

The "prompt" field is a flat text prompt (backward compatible). The "structured_prompt" field breaks it into environment/lighting/style/product components. Both are required.`;
  }

  private buildPlanningUserPrompt(
    productData: { product_name: string; category: string; selling_points?: string[] },
    productImageUrl: string | null,
    scenes: Array<{
      segment_index: number;
      section: string;
      script_text: string;
      syllable_count: number;
      shot_scripts: unknown;
      broll_cues: unknown;
      product_visibility: string;
    }>,
    segmentShotCounts: Array<{ segmentIndex: number; syllables: number; shotCount: number }>,
    preset: BrollPreset,
    category: string,
  ): string {
    const sellingPoints = productData.selling_points
      ? productData.selling_points.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'N/A';

    let prompt = `PRODUCT: ${productData.product_name} (${productData.category})
SELLING POINTS:
${sellingPoints}
${productImageUrl ? `PRODUCT IMAGE: ${productImageUrl}` : ''}

SCRIPT SEGMENTS:`;

    for (const scene of scenes) {
      const shotScripts = scene.shot_scripts as Array<{ index: number; text: string }> | null;
      prompt += `\n\nSegment ${scene.segment_index} (${scene.section}, ${scene.syllable_count} syllables, product_visibility: ${scene.product_visibility}):`;
      if (shotScripts) {
        for (const shot of shotScripts) {
          const startTime = scene.segment_index * 15 + shot.index * 5;
          prompt += `\n  Shot ${shot.index} (${startTime}-${startTime + 5}s): "${shot.text}"`;
        }
      }

      // Include existing broll_cues from ScriptingAgent as timing hints
      const cues = scene.broll_cues as BrollCue[] | null;
      if (cues && cues.length > 0) {
        prompt += `\n  Timing cues from script:`;
        for (const cue of cues) {
          prompt += `\n    @${cue.offset_seconds}s (${cue.duration_seconds}s): "${cue.intent}" — "${cue.spoken_text_during}"`;
        }
      }
    }

    prompt += `\n\nB-ROLL PRESET for ${category}:
Categories: ${preset.categories.join(', ')}`;

    for (const [catName, catPreset] of Object.entries(preset.presets)) {
      prompt += `\n\n${catName}: ${catPreset.description}
  Template: ${catPreset.shotTemplate}
  Details: ${catPreset.details.join(', ')}
  Narrative role: ${catPreset.narrativeRole}`;
    }

    prompt += `\n\nNARRATIVE ARC GUIDE:`;
    for (const [section, categories] of Object.entries(BROLL_NARRATIVE_ARC)) {
      prompt += `\n  ${section}: prefer ${categories.join(', ')}`;
    }

    prompt += `\n\nTARGET SHOT COUNT PER SEGMENT:`;
    for (const seg of segmentShotCounts) {
      prompt += `\n  Segment ${seg.segmentIndex}: ${seg.shotCount} shots (${seg.syllables} syllables)`;
    }

    prompt += `\n\nGenerate a JSON array of B-roll shots. Use the preset templates and details to create specific, photorealistic prompts. Respect the timing cues from the script when available.`;

    return prompt;
  }
}
