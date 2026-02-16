import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { AVATAR_MAPPING, PRODUCT_PLACEMENT_ARC, ENERGY_ARC, API_COSTS, RESOLUTION } from '@/lib/constants';

const NEGATIVE_PROMPT = 'watermark, text, logo, blurry, deformed, ugly, duplicate, extra limbs, poorly drawn';

const SEGMENTS = [0, 1, 2, 3];

export class CastingAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('CastingAgent', supabaseClient);
  }

  async run(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'casting');
    this.log(`Starting casting for project ${projectId}`);

    // 1. Fetch project with character, scene preset, and interaction preset
    const { data: project, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*), influencer:influencer(*), product:product(*), scene_preset:scene_preset(*), interaction_preset:interaction_preset(*)')
      .eq('id', projectId)
      .single();

    if (projError || !project) throw new Error('Project not found');

    // 2. Get the approved script's latest scenes
    const { data: scripts } = await this.supabase
      .from('script')
      .select('id')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const scriptId = scripts?.[0]?.id;
    if (!scriptId) throw new Error('No script found');

    const { data: allScenes } = await this.supabase
      .from('scene')
      .select('*')
      .eq('script_id', scriptId)
      .order('segment_index')
      .order('version', { ascending: false });

    // Deduplicate to latest version per segment
    const latestScenes = new Map<number, any>();
    for (const scene of allScenes || []) {
      if (!latestScenes.has(scene.segment_index)) {
        latestScenes.set(scene.segment_index, scene);
      }
    }

    // 3. Detect influencer-based generation and product image
    const influencer = project.influencer;
    const useInfluencer = !!influencer?.image_url;
    const productImageUrl: string | null = project.product_image_url || project.product?.image_url || null;

    // 4. Determine avatar info
    const character = project.character;
    const category = project.product_category || 'supplements';
    const avatarFallback = AVATAR_MAPPING[category] || AVATAR_MAPPING.supplements;
    const appearance = character?.avatar_persona || avatarFallback.appearance;
    const wardrobe = avatarFallback.wardrobe;

    // Scene priority: override > preset > legacy fallback
    const sceneDescription = project.scene_override
      || project.scene_preset?.description
      || avatarFallback.setting;

    // Interaction priority: override > preset > null (uses PRODUCT_PLACEMENT_ARC description)
    const interactionDescription = project.interaction_override
      || project.interaction_preset?.description
      || null;

    // 5. Load custom product placement overrides (if user set them)
    const customPlacement = project.product_placement as
      | { segment: number; visibility: string; description: string; notes?: string }[]
      | null;

    // 6. For each segment, generate start + end keyframes (with per-segment error recovery)
    let segmentsCompleted = 0;
    for (const segIdx of SEGMENTS) {
      const scene = latestScenes.get(segIdx);
      if (!scene) {
        this.log(`Scene for segment ${segIdx} not found, skipping`);
        continue;
      }

      const defaultPlacement = PRODUCT_PLACEMENT_ARC[segIdx];
      const userOverride = customPlacement?.find((p) => p.segment === segIdx);
      const placement = userOverride
        ? {
            ...defaultPlacement,
            visibility: userOverride.visibility || defaultPlacement.visibility,
            description: userOverride.notes
              ? `${defaultPlacement.description}. User note: ${userOverride.notes}`
              : defaultPlacement.description,
          }
        : defaultPlacement;
      const energyArc = ENERGY_ARC[segIdx];

      const maxRetries = 1;
      let segmentSuccess = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            this.log(`Retry ${attempt}/${maxRetries} for segment ${segIdx} after 5s delay...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          // Use LLM to generate detailed prompts for start and end frames
          const sealSegment = project.video_analysis?.segments?.[segIdx] || null;
          const hasProductRef = !!productImageUrl;
          const promptPair = await this.generateVisualPrompts(
            appearance, wardrobe, sceneDescription,
            scene, placement, energyArc,
            project.product_name || 'the product',
            projectId,
            useInfluencer || hasProductRef,
            sealSegment,
            interactionDescription,
            hasProductRef,
          );

          // Save visual prompts to scene
          await this.supabase
            .from('scene')
            .update({ visual_prompt: promptPair })
            .eq('id', scene.id);

          // Build reference images array: influencer + product image
          const referenceImages: string[] = [];
          if (useInfluencer) referenceImages.push(influencer.image_url);
          if (productImageUrl) referenceImages.push(productImageUrl);

          if (referenceImages.length > 0) {
            // Image-to-image: edit with reference images (influencer and/or product)
            const refLabels = [
              useInfluencer ? `influencer: ${influencer.name}` : null,
              productImageUrl ? 'product image' : null,
            ].filter(Boolean).join(' + ');
            this.log(`Using reference images: ${refLabels}`);

            const editOpts = { aspectRatio: RESOLUTION.aspectRatio, resolution: '1k' as const };

            this.log(`Generating start keyframe (edit) for segment ${segIdx} (attempt ${attempt + 1})`);
            const startResult = await this.wavespeed.editImage(referenceImages, promptPair.start, editOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId, 'nano-banana-pro-edit');

            this.log(`Generating end keyframe (edit) for segment ${segIdx}`);
            const endResult = await this.wavespeed.editImage(referenceImages, promptPair.end, editOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId, 'nano-banana-pro-edit');

            // Poll both tasks
            this.log(`Polling start keyframe task ${startResult.taskId}`);
            const startPoll = await this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            await this.updateAssetUrl(startResult.taskId, startPoll.url || '');

            this.log(`Polling end keyframe task ${endResult.taskId}`);
            const endPoll = await this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            await this.updateAssetUrl(endResult.taskId, endPoll.url || '');

            // Track cost: 2 edit images
            await this.trackCost(projectId, API_COSTS.nanoBananaProEdit * 2);
          } else {
            // Text-to-image: no reference images available
            const imgOpts = { aspectRatio: RESOLUTION.aspectRatio, width: RESOLUTION.width, height: RESOLUTION.height };

            this.log(`Generating start keyframe for segment ${segIdx} (attempt ${attempt + 1})`);
            const startResult = await this.wavespeed.generateImage(promptPair.start, imgOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId);

            this.log(`Generating end keyframe for segment ${segIdx}`);
            const endResult = await this.wavespeed.generateImage(promptPair.end, imgOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId);

            // Poll both tasks
            this.log(`Polling start keyframe task ${startResult.taskId}`);
            const startPoll = await this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            await this.updateAssetUrl(startResult.taskId, startPoll.url || '');

            this.log(`Polling end keyframe task ${endResult.taskId}`);
            const endPoll = await this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            await this.updateAssetUrl(endResult.taskId, endPoll.url || '');

            // Track cost: 2 text-to-image generations
            await this.trackCost(projectId, API_COSTS.nanoBananaPro * 2);
          }

          segmentSuccess = true;
          segmentsCompleted++;
          break;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.log(`Casting failed for segment ${segIdx} (attempt ${attempt + 1}): ${errMsg}`);
          await this.logEvent(projectId, 'segment_error', 'casting', {
            segment: segIdx,
            attempt: attempt + 1,
            error: errMsg,
            useInfluencer,
          });
        }
      }

      if (!segmentSuccess) {
        const failedProvider = (useInfluencer || productImageUrl) ? 'nano-banana-pro-edit' : 'nano-banana-pro';
        this.log(`All retries exhausted for segment ${segIdx}, creating failed assets`);
        await this.supabase.from('asset').insert([
          { project_id: projectId, scene_id: scene.id, type: 'keyframe_start', provider: failedProvider, status: 'failed', cost_usd: 0 },
          { project_id: projectId, scene_id: scene.id, type: 'keyframe_end', provider: failedProvider, status: 'failed', cost_usd: 0 },
        ]);
      }
    }

    if (segmentsCompleted === 0) {
      throw new Error('All segments failed during casting');
    }

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'casting', { durationMs });
    this.log(`Casting complete for project ${projectId}`);
  }

  private async generateVisualPrompts(
    appearance: string,
    wardrobe: string,
    sceneDescription: string,
    scene: any,
    placement: { section: string; visibility: string; description: string },
    energyArc: (typeof ENERGY_ARC)[number],
    productName: string,
    projectId: string,
    isEdit: boolean = false,
    sealData?: any | null,
    interactionDescription?: string | null,
    hasProductImage: boolean = false,
  ): Promise<{ start: string; end: string }> {
    const consistencyRule = `CONSISTENCY RULE: All 4 segments MUST use the same room, lighting setup, and props. Only vary: character pose, energy level, product visibility, and camera micro-adjustments (slight angle shift, subtle lighting warmth change matching energy arc). The video must look like one continuous shoot in one location.`;

    const productImageRule = hasProductImage
      ? `\nPRODUCT IMAGE RULE: A reference image of the real product is provided. The product in the generated image MUST match this reference EXACTLY — same packaging, shape, colors, label, and branding. Do NOT imagine or invent a different product appearance. The real product image is the ground truth.`
      : '';

    const systemPrompt = isEdit
      ? `You are a visual prompt engineer for Nano Banana Pro image EDITING.
Generate two edit prompts that describe how to transform reference images into specific scene contexts.
${hasProductImage ? 'Reference images include the person AND the actual product. Preserve both likenesses.' : 'Keep the person\'s likeness but change their pose, wardrobe, setting, and energy.'}
${consistencyRule}${productImageRule}
Output ONLY valid JSON: { "start": "...", "end": "..." }`
      : `You are a visual prompt engineer for Nano Banana Pro image generation.
Generate two detailed image prompts for a TikTok video keyframe: one for the START of the segment and one for the END.
Both should show the SAME person in the SAME setting but with different poses/energy matching the energy arc.
${consistencyRule}
Output ONLY valid JSON: { "start": "...", "end": "..." }`;

    const interactionLine = interactionDescription
      ? `Product interaction: ${interactionDescription}`
      : `Product interaction: ${placement.description}`;

    const productRefLine = hasProductImage
      ? `\nIMPORTANT: The real product image is provided as a reference. Preserve the EXACT product appearance — packaging, shape, colors, label, and branding. Do not invent or alter the product's look.`
      : '';

    const userPrompt = isEdit
      ? `Transform the reference images into the following scene context:
Wardrobe: ${wardrobe}
Scene: ${sceneDescription}
${interactionLine}
Segment: ${placement.section} (${placement.description})
Product: ${productName}
Product visibility: ${placement.visibility}
Energy arc: starts at ${energyArc.pattern.start}, peaks at ${energyArc.pattern.middle}, ends at ${energyArc.pattern.end}
Script context: ${scene.script_text || 'N/A'}
Text overlay: ${scene.text_overlay || 'N/A'}${productRefLine}

Generate START frame edit prompt (energy: ${energyArc.pattern.start}) and END frame edit prompt (energy: ${energyArc.pattern.end}).
Describe how to transform the person's pose, wardrobe, scene, and energy for each frame.
The product must appear exactly as shown in the reference image when visible.
Keep the scene LOCKED — same room, same lighting, same props across all segments.
Aspect ratio: 9:16 portrait. Photorealistic. No text/watermarks in the image.
Negative: ${NEGATIVE_PROMPT}`
      : `Character: ${appearance}
Wardrobe: ${wardrobe}
Scene: ${sceneDescription}
${interactionLine}
Segment: ${placement.section} (${placement.description})
Product: ${productName}
Product visibility: ${placement.visibility}
Energy arc: starts at ${energyArc.pattern.start}, peaks at ${energyArc.pattern.middle}, ends at ${energyArc.pattern.end}
Script context: ${scene.script_text || 'N/A'}
Text overlay: ${scene.text_overlay || 'N/A'}

Generate START frame prompt (energy: ${energyArc.pattern.start}) and END frame prompt (energy: ${energyArc.pattern.end}).
Keep the scene LOCKED — same room, same lighting, same props across all segments.
Aspect ratio: 9:16 portrait. Photorealistic. No text/watermarks in the image.
Negative: ${NEGATIVE_PROMPT}`;

    // Enrich with SEAL reference data if available
    let enrichedUserPrompt = userPrompt;
    if (sealData) {
      enrichedUserPrompt += `\n\nREFERENCE VIDEO SEAL DATA (match this visual style):
  Scene: ${sealData.scene?.setting || 'N/A'}, ${sealData.scene?.composition || 'N/A'}
  Props: ${(sealData.scene?.props || []).join(', ') || 'none'}
  Shot type: ${sealData.angle?.shotType || 'medium'}, Camera: ${sealData.angle?.cameraMovement || 'static'}
  Lighting: ${sealData.lighting?.style || 'natural'}, ${sealData.lighting?.colorTemp || 'neutral'} temp, ${sealData.lighting?.contrast || 'medium'} contrast
  Mood: ${sealData.emotion?.mood || 'neutral'}

Match this reference video's visual style: use similar lighting, camera angle, and composition.`;
    }

    const response = await this.wavespeed.chatCompletion(systemPrompt, enrichedUserPrompt);
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    try {
      // Parse the JSON response, handling potential markdown code blocks
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { start: parsed.start, end: parsed.end };
    } catch {
      // Fallback: use template-based prompts
      this.log('LLM prompt generation failed, using template fallback');
      const base = `${appearance}, ${wardrobe}, ${sceneDescription}, 9:16 portrait, photorealistic, cinematic lighting`;
      return {
        start: `${base}, ${energyArc.pattern.start.toLowerCase()} energy, opening pose, ${placement.visibility} product visibility`,
        end: `${base}, ${energyArc.pattern.end.toLowerCase()} energy, closing pose, ${placement.visibility} product visibility`,
      };
    }
  }

  private async createAsset(
    projectId: string,
    sceneId: string,
    type: 'keyframe_start' | 'keyframe_end',
    taskId: string,
    provider: string = 'nano-banana-pro',
  ): Promise<void> {
    const costPerImage = provider === 'nano-banana-pro-edit'
      ? API_COSTS.nanoBananaProEdit
      : API_COSTS.nanoBananaPro;

    await this.supabase.from('asset').insert({
      project_id: projectId,
      scene_id: sceneId,
      type,
      provider,
      provider_task_id: taskId,
      status: 'generating',
      cost_usd: costPerImage,
    });
  }

  private async updateAssetUrl(taskId: string, url: string): Promise<void> {
    await this.supabase
      .from('asset')
      .update({ url, status: 'completed' })
      .eq('provider_task_id', taskId);
  }
}
