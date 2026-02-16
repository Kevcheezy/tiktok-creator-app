import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { AVATAR_MAPPING, PRODUCT_PLACEMENT_ARC, ENERGY_ARC, API_COSTS, RESOLUTION, VISIBILITY_ANGLE_MAP } from '@/lib/constants';

const NEGATIVE_PROMPT = 'watermark, text, logo, blurry, deformed, ugly, duplicate, extra limbs, poorly drawn';

const CONTINUITY_PROMPT = 'CONTINUITY: This frame continues directly from the previous segment. The FIRST reference image is the previous segment\'s end frame. Preserve the EXACT same person, room, lighting, and wardrobe. Only change: pose, energy level, and product visibility as specified.';

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

    // Fetch multi-angle product images
    type ProductImg = { id: string; url: string; url_clean: string | null; angle: string; is_primary: boolean };
    let productImages: ProductImg[] = [];
    const productId = project.product_id || project.product?.id;
    if (productId) {
      const { data: imgs } = await this.supabase
        .from('product_image')
        .select('id, url, url_clean, angle, is_primary')
        .eq('product_id', productId)
        .order('sort_order');
      productImages = (imgs || []) as ProductImg[];
    }

    // Legacy fallback: if no product_image rows, use single URL
    const legacyProductImageUrl: string | null =
      productImages.length === 0
        ? (project.product_image_url || project.product?.image_url || null)
        : null;

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

    // 3. Detect influencer-based generation
    const influencer = project.influencer;
    const useInfluencer = !!influencer?.image_url;

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

    // 6. Clean up any existing keyframe assets from previous casting runs
    //    Prevents accumulation when re-casting or when duplicate jobs run concurrently.
    const { data: oldKeyframes } = await this.supabase
      .from('asset')
      .select('id')
      .eq('project_id', projectId)
      .in('type', ['keyframe_start', 'keyframe_end']);

    if (oldKeyframes && oldKeyframes.length > 0) {
      const oldIds = oldKeyframes.map((a) => a.id);
      await this.supabase.from('asset').delete().in('id', oldIds);
      this.log(`Cleaned up ${oldIds.length} old keyframe assets before re-casting`);
    }

    // 7. Sequential chained keyframe generation
    //    Each segment's end frame feeds into the next segment as the primary reference image.
    //    This ensures visual consistency (same person, room, lighting) across all 4 segments.
    let segmentsCompleted = 0;
    let previousEndFrameUrl: string | null = null;

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

      const segmentProductImage = this.selectProductImageForSegment(segIdx, productImages, legacyProductImageUrl);
      const maxRetries = 1;
      let segmentSuccess = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            this.log(`Retry ${attempt}/${maxRetries} for segment ${segIdx} after 5s delay...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          const isContinuation = segIdx > 0 && !!previousEndFrameUrl;

          // Use LLM to generate detailed prompts for start and end frames
          const sealSegment = project.video_analysis?.segments?.[segIdx] || null;
          const hasProductRef = !!segmentProductImage;
          const promptPair = await this.generateVisualPrompts(
            appearance, wardrobe, sceneDescription,
            scene, placement, energyArc,
            project.product_name || 'the product',
            projectId,
            useInfluencer || hasProductRef || isContinuation,
            sealSegment,
            interactionDescription,
            hasProductRef,
            isContinuation,
          );

          // Save visual prompts to scene
          await this.supabase
            .from('scene')
            .update({ visual_prompt: promptPair })
            .eq('id', scene.id);

          // Build reference images: previous end frame (chain) + influencer + product
          const referenceImages: string[] = [];
          if (previousEndFrameUrl) referenceImages.push(previousEndFrameUrl);
          if (useInfluencer) referenceImages.push(influencer.image_url);
          if (segmentProductImage) referenceImages.push(segmentProductImage);

          let startUrl = '';
          let endUrl = '';

          if (referenceImages.length > 0) {
            // Edit mode: use reference images
            const editOpts = { aspectRatio: RESOLUTION.aspectRatio, resolution: '1k' as const };

            const refLabels = [
              previousEndFrameUrl ? 'prev_end_frame' : null,
              useInfluencer ? `influencer: ${influencer.name}` : null,
              segmentProductImage ? `product (${productImages.find(i => (i.url_clean || i.url) === segmentProductImage)?.angle || 'legacy'})` : null,
            ].filter(Boolean).join(' + ');

            // INNER CHAIN: Generate start first, then use start as reference for end.
            // This ensures the same person appears in both keyframes of a segment.
            this.log(`Segment ${segIdx}: generating START keyframe with refs [${refLabels}] (attempt ${attempt + 1})`);
            const startResult = await this.wavespeed.editImage(referenceImages, promptPair.start, editOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId, 'nano-banana-pro-edit');
            const startPoll = await this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            startUrl = startPoll.url || '';
            await this.updateAssetUrl(startResult.taskId, startUrl);

            // End frame: prepend the start frame as primary reference for face/scene consistency
            const endRefs = startUrl ? [startUrl, ...referenceImages] : referenceImages;
            this.log(`Segment ${segIdx}: generating END keyframe with start frame as primary ref (attempt ${attempt + 1})`);
            const endResult = await this.wavespeed.editImage(endRefs, promptPair.end, editOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId, 'nano-banana-pro-edit');
            const endPoll = await this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            endUrl = endPoll.url || '';
            await this.updateAssetUrl(endResult.taskId, endUrl);

            await this.trackCost(projectId, API_COSTS.nanoBananaProEdit * 2);
          } else {
            // Text-to-image for start, then edit for end using start as reference
            const imgOpts = { aspectRatio: RESOLUTION.aspectRatio, width: RESOLUTION.width, height: RESOLUTION.height };

            this.log(`Segment ${segIdx}: text-to-image START (no references) (attempt ${attempt + 1})`);
            const startResult = await this.wavespeed.generateImage(promptPair.start, imgOpts);
            await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId);
            const startPoll = await this.wavespeed.pollResult(startResult.taskId, { maxWait: 120000, initialInterval: 5000 });
            startUrl = startPoll.url || '';
            await this.updateAssetUrl(startResult.taskId, startUrl);

            if (startUrl) {
              // Use start frame as reference for end frame (edit mode) to preserve face
              const editOpts = { aspectRatio: RESOLUTION.aspectRatio, resolution: '1k' as const };
              this.log(`Segment ${segIdx}: generating END keyframe using start frame as ref (attempt ${attempt + 1})`);
              const endResult = await this.wavespeed.editImage([startUrl], promptPair.end, editOpts);
              await this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId, 'nano-banana-pro-edit');
              const endPoll = await this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 });
              endUrl = endPoll.url || '';
              await this.updateAssetUrl(endResult.taskId, endUrl);
              await this.trackCost(projectId, API_COSTS.nanoBananaPro + API_COSTS.nanoBananaProEdit);
            } else {
              // Fallback: generate end independently if start failed
              this.log(`Segment ${segIdx}: text-to-image END (start failed) (attempt ${attempt + 1})`);
              const endResult = await this.wavespeed.generateImage(promptPair.end, imgOpts);
              await this.createAsset(projectId, scene.id, 'keyframe_end', endResult.taskId);
              const endPoll = await this.wavespeed.pollResult(endResult.taskId, { maxWait: 120000, initialInterval: 5000 });
              endUrl = endPoll.url || '';
              await this.updateAssetUrl(endResult.taskId, endUrl);
              await this.trackCost(projectId, API_COSTS.nanoBananaPro * 2);
            }
          }

          // Chain: pass this segment's end frame URL to next segment
          if (endUrl) {
            previousEndFrameUrl = endUrl;
            this.log(`Segment ${segIdx} end frame chained → next segment`);
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
            chained: !!previousEndFrameUrl,
          });
        }
      }

      if (!segmentSuccess) {
        const failedProvider = (useInfluencer || segmentProductImage || previousEndFrameUrl) ? 'nano-banana-pro-edit' : 'nano-banana-pro';
        this.log(`All retries exhausted for segment ${segIdx}, creating failed assets`);
        await this.supabase.from('asset').insert([
          { project_id: projectId, scene_id: scene.id, type: 'keyframe_start', provider: failedProvider, status: 'failed', cost_usd: 0 },
          { project_id: projectId, scene_id: scene.id, type: 'keyframe_end', provider: failedProvider, status: 'failed', cost_usd: 0 },
        ]);
        // previousEndFrameUrl stays at last successful value — graceful degradation
      }
    }

    if (segmentsCompleted === 0) {
      throw new Error('All segments failed during casting');
    }

    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'casting', { durationMs, segmentsCompleted });
    this.log(`Casting complete for project ${projectId} (${segmentsCompleted}/4 segments, chained=${!!previousEndFrameUrl})`);
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
    isContinuation: boolean = false,
  ): Promise<{ start: string; end: string }> {
    const consistencyRule = `CONSISTENCY RULE: All 4 segments MUST use the same room, lighting setup, and props. Only vary: character pose, energy level, product visibility, and camera micro-adjustments (slight angle shift, subtle lighting warmth change matching energy arc). The video must look like one continuous shoot in one location.`;

    const productImageRule = hasProductImage
      ? `\nPRODUCT IMAGE RULE: A reference image of the real product is provided. The product in the generated image MUST match this reference EXACTLY — same packaging, shape, colors, label, and branding. Do NOT imagine or invent a different product appearance. The real product image is the ground truth.`
      : '';

    const continuityNote = isContinuation
      ? `\nThe FIRST reference image is the previous segment's end frame. Preserve its exact appearance — same person, room, lighting, wardrobe. Evolve only the pose and energy.`
      : '';

    const systemPrompt = isEdit
      ? `You are a visual prompt engineer for Nano Banana Pro image EDITING.
Generate two edit prompts that describe how to transform reference images into specific scene contexts.
${hasProductImage ? 'Reference images include the person AND the actual product. Preserve both likenesses.' : 'Keep the person\'s likeness but change their pose, wardrobe, setting, and energy.'}
${consistencyRule}${productImageRule}${continuityNote}
Output ONLY valid JSON: { "start": "...", "end": "..." }`
      : `You are a visual prompt engineer for Nano Banana Pro image generation.
Generate two detailed image prompts for a TikTok video keyframe: one for the START of the segment and one for the END.
Both should show the SAME person in the SAME setting but with different poses/energy matching the energy arc.
${consistencyRule}
Output ONLY valid JSON: { "start": "...", "end": "..." }`;

    const interactionLine = interactionDescription
      ? `Product interaction: ${interactionDescription}`
      : `Product interaction: ${placement.description}`;

    // Camera specs from scene tagging (R1.5.10)
    const cameraSpecs = scene.camera_specs as { angle?: string; movement?: string; lighting?: string } | null;
    const cameraLine = cameraSpecs
      ? `Camera: ${cameraSpecs.angle || 'medium'} shot, ${cameraSpecs.movement || 'static'}, ${cameraSpecs.lighting || 'natural_window'} lighting`
      : null;

    const productRefLine = hasProductImage
      ? `\nIMPORTANT: The real product image is provided as a reference. Preserve the EXACT product appearance — packaging, shape, colors, label, and branding. Do not invent or alter the product's look.`
      : '';

    let userPrompt = isEdit
      ? `Transform the reference images into the following scene context:
Wardrobe: ${wardrobe}
Scene: ${sceneDescription}
${interactionLine}${cameraLine ? `\n${cameraLine}` : ''}
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
${interactionLine}${cameraLine ? `\n${cameraLine}` : ''}
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

    // Prepend continuity instruction for chained segments
    if (isContinuation) {
      userPrompt = `${CONTINUITY_PROMPT}\n\n${userPrompt}`;
    }

    // Enrich with SEAL reference data if available
    if (sealData) {
      userPrompt += `\n\nREFERENCE VIDEO SEAL DATA (match this visual style):
  Scene: ${sealData.scene?.setting || 'N/A'}, ${sealData.scene?.composition || 'N/A'}
  Props: ${(sealData.scene?.props || []).join(', ') || 'none'}
  Shot type: ${sealData.angle?.shotType || 'medium'}, Camera: ${sealData.angle?.cameraMovement || 'static'}
  Lighting: ${sealData.lighting?.style || 'natural'}, ${sealData.lighting?.colorTemp || 'neutral'} temp, ${sealData.lighting?.contrast || 'medium'} contrast
  Mood: ${sealData.emotion?.mood || 'neutral'}

Match this reference video's visual style: use similar lighting, camera angle, and composition.`;
    }

    const response = await this.wavespeed.chatCompletion(systemPrompt, userPrompt);
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    try {
      // Parse the JSON response, handling potential markdown code blocks
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return { start: parsed.start, end: parsed.end };
    } catch {
      // Fallback: use template-based prompts
      this.log('LLM prompt generation failed, using template fallback');
      const cameraStr = cameraSpecs
        ? `${cameraSpecs.angle || 'medium'} shot, ${cameraSpecs.movement || 'static'}, ${cameraSpecs.lighting || 'natural_window'} lighting`
        : 'medium shot, static, cinematic lighting';
      const base = `${appearance}, ${wardrobe}, ${sceneDescription}, ${cameraStr}, 9:16 portrait, photorealistic`;
      return {
        start: `${base}, ${energyArc.pattern.start.toLowerCase()} energy, opening pose, ${placement.visibility} product visibility`,
        end: `${base}, ${energyArc.pattern.end.toLowerCase()} energy, closing pose, ${placement.visibility} product visibility`,
      };
    }
  }

  private selectProductImageForSegment(
    segmentIndex: number,
    productImages: Array<{ url: string; url_clean: string | null; angle: string; is_primary: boolean }>,
    legacyUrl: string | null,
  ): string | null {
    const placement = PRODUCT_PLACEMENT_ARC[segmentIndex];
    if (!placement) return null;

    const visibility = placement.visibility;

    // No product image for 'none' visibility (hook segment)
    if (visibility === 'none') return null;

    // Legacy fallback
    if (productImages.length === 0) return legacyUrl;

    // Get preferred angles for this visibility level
    const preferredAngles = VISIBILITY_ANGLE_MAP[visibility] || ['front'];

    // Try to find a matching angle in priority order
    for (const angle of preferredAngles) {
      const match = productImages.find(img => img.angle === angle);
      if (match) return match.url_clean || match.url;
    }

    // Fallback: primary image
    const primary = productImages.find(img => img.is_primary);
    if (primary) return primary.url_clean || primary.url;

    // Last resort: first image
    return productImages[0].url_clean || productImages[0].url;
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
