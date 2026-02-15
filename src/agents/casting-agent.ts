import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { AVATAR_MAPPING, PRODUCT_PLACEMENT_ARC, ENERGY_ARC, API_COSTS } from '@/lib/constants';

const NEGATIVE_PROMPT = 'watermark, text, logo, blurry, deformed, ugly, duplicate, extra limbs, poorly drawn';

const SEGMENTS = [0, 1, 2, 3];

export class CastingAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('CastingAgent', supabaseClient);
  }

  async run(projectId: string): Promise<void> {
    this.log(`Starting casting for project ${projectId}`);

    // 1. Fetch project with character
    const { data: project, error: projError } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*), influencer:influencer(*)')
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

    // 3. Detect influencer-based generation
    const influencer = project.influencer;
    const useInfluencer = !!influencer?.image_url;

    // 4. Determine avatar info
    const character = project.character;
    const category = project.product_category || 'supplements';
    const avatarFallback = AVATAR_MAPPING[category] || AVATAR_MAPPING.supplements;
    const appearance = character?.avatar_persona || avatarFallback.appearance;
    const wardrobe = avatarFallback.wardrobe;
    const setting = avatarFallback.setting;

    // 5. Load custom product placement overrides (if user set them)
    const customPlacement = project.product_placement as
      | { segment: number; visibility: string; description: string; notes?: string }[]
      | null;

    // 6. For each segment, generate start + end keyframes
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

      // Use LLM to generate detailed prompts for start and end frames
      const promptPair = await this.generateVisualPrompts(
        appearance, wardrobe, setting,
        scene, placement, energyArc,
        project.product_name || 'the product',
        projectId,
        useInfluencer,
      );

      // Save visual prompts to scene
      await this.supabase
        .from('scene')
        .update({ visual_prompt: promptPair })
        .eq('id', scene.id);

      if (useInfluencer) {
        // Image-to-image: edit the influencer's reference photo
        this.log(`Using influencer reference: ${influencer.name}`);

        this.log(`Generating start keyframe (edit) for segment ${segIdx}`);
        const startResult = await this.wavespeed.editImage([influencer.image_url], promptPair.start, { aspectRatio: '9:16' });
        await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId, 'nano-banana-pro-edit');

        this.log(`Generating end keyframe (edit) for segment ${segIdx}`);
        const endResult = await this.wavespeed.editImage([influencer.image_url], promptPair.end, { aspectRatio: '9:16' });
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
        // Text-to-image: existing flow
        this.log(`Generating start keyframe for segment ${segIdx}`);
        const startResult = await this.wavespeed.generateImage(promptPair.start);
        await this.createAsset(projectId, scene.id, 'keyframe_start', startResult.taskId);

        this.log(`Generating end keyframe for segment ${segIdx}`);
        const endResult = await this.wavespeed.generateImage(promptPair.end);
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
    }

    this.log(`Casting complete for project ${projectId}`);
  }

  private async generateVisualPrompts(
    appearance: string,
    wardrobe: string,
    setting: string,
    scene: any,
    placement: { section: string; visibility: string; description: string },
    energyArc: (typeof ENERGY_ARC)[number],
    productName: string,
    projectId: string,
    isEdit: boolean = false,
  ): Promise<{ start: string; end: string }> {
    const systemPrompt = isEdit
      ? `You are a visual prompt engineer for Nano Banana Pro image EDITING.
Generate two edit prompts that describe how to transform a reference photo of a person into specific scene contexts.
Keep the person's likeness but change their pose, wardrobe, setting, and energy.
Output ONLY valid JSON: { "start": "...", "end": "..." }`
      : `You are a visual prompt engineer for Nano Banana Pro image generation.
Generate two detailed image prompts for a TikTok video keyframe: one for the START of the segment and one for the END.
Both should show the SAME person in the SAME setting but with different poses/energy matching the energy arc.
Output ONLY valid JSON: { "start": "...", "end": "..." }`;

    const userPrompt = isEdit
      ? `Transform this person into the following scene context:
Wardrobe: ${wardrobe}
Setting: ${setting}
Segment: ${placement.section} (${placement.description})
Product: ${productName}
Product visibility: ${placement.visibility}
Energy arc: starts at ${energyArc.pattern.start}, peaks at ${energyArc.pattern.middle}, ends at ${energyArc.pattern.end}
Script context: ${scene.script_text || 'N/A'}
Text overlay: ${scene.text_overlay || 'N/A'}

Generate START frame edit prompt (energy: ${energyArc.pattern.start}) and END frame edit prompt (energy: ${energyArc.pattern.end}).
Describe how to transform this person's pose, wardrobe, setting, and energy for each frame.
Aspect ratio: 9:16 portrait. Photorealistic. No text/watermarks in the image.
Negative: ${NEGATIVE_PROMPT}`
      : `Character: ${appearance}
Wardrobe: ${wardrobe}
Setting: ${setting}
Segment: ${placement.section} (${placement.description})
Product: ${productName}
Product visibility: ${placement.visibility}
Energy arc: starts at ${energyArc.pattern.start}, peaks at ${energyArc.pattern.middle}, ends at ${energyArc.pattern.end}
Script context: ${scene.script_text || 'N/A'}
Text overlay: ${scene.text_overlay || 'N/A'}

Generate START frame prompt (energy: ${energyArc.pattern.start}) and END frame prompt (energy: ${energyArc.pattern.end}).
Aspect ratio: 9:16 portrait. Photorealistic. No text/watermarks in the image.
Negative: ${NEGATIVE_PROMPT}`;

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
      const base = `${appearance}, ${wardrobe}, ${setting}, 9:16 portrait, photorealistic, cinematic lighting`;
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
