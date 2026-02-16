import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { CreatomateClient } from '@/lib/api-clients/creatomate';
import {
  CREATOMATE_TEMPLATE_ID,
  API_COSTS,
  RESOLUTION,
  KEN_BURNS_PRESETS,
  pickKenBurnsDirection,
  type KenBurnsDirection,
} from '@/lib/constants';
import type { ModificationValue } from '@/lib/api-clients/creatomate';

export class EditorAgent extends BaseAgent {
  private creatomate: CreatomateClient;

  constructor(supabaseClient?: SupabaseClient) {
    super('EditorAgent', supabaseClient);
    this.creatomate = new CreatomateClient();
  }

  async run(projectId: string): Promise<void> {
    const stageStart = Date.now();
    await this.logEvent(projectId, 'stage_start', 'editing');
    this.log(`Starting editing for project ${projectId}`);

    // 1. Fetch all completed video and audio assets with scene text overlays
    const { data: assets, error } = await this.supabase
      .from('asset')
      .select('*, scene:scene(segment_index, text_overlay)')
      .eq('project_id', projectId)
      .in('type', ['video', 'audio'])
      .eq('status', 'completed');

    if (error) throw new Error(`Failed to fetch assets: ${error.message}`);
    if (!assets || assets.length === 0) throw new Error('No completed assets found');

    // 1b. Fetch completed B-roll shots with timing metadata
    const { data: brollShots } = await this.supabase
      .from('broll_shot')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('segment_index')
      .order('shot_index');

    // 2. Build modifications map for Creatomate template
    const modifications: Record<string, ModificationValue> = {};
    const textOverlays = new Map<number, string>();

    for (const asset of assets) {
      const segIdx = asset.scene?.segment_index;
      if (segIdx === null || segIdx === undefined) continue;
      if (!asset.url) continue;

      const slotNum = segIdx + 1;

      if (asset.type === 'video') {
        // Mute Kling's native audio track — only ElevenLabs TTS should be heard
        modifications[`Video-${slotNum}`] = { source: asset.url, volume: '0%' };
      } else if (asset.type === 'audio') {
        modifications[`Audio-${slotNum}`] = asset.url;
      }

      // Collect text overlays from scene data (deduplicated by segment)
      if (asset.scene?.text_overlay && !textOverlays.has(segIdx)) {
        textOverlays.set(segIdx, asset.scene.text_overlay);
      }
    }

    // Add text overlay modifications for each segment
    for (const [segIdx, text] of textOverlays) {
      modifications[`Text-${segIdx + 1}`] = text;
    }

    // Add B-roll image modifications with Ken Burns zoom/pan effect
    if (brollShots && brollShots.length > 0) {
      for (const shot of brollShots) {
        if (shot.image_url) {
          const slotKey = `Broll-${shot.segment_index + 1}-${shot.shot_index + 1}`;
          const direction = pickKenBurnsDirection(shot.shot_index);
          const preset = KEN_BURNS_PRESETS[direction];

          modifications[slotKey] = {
            source: shot.image_url,
            x_scale: [
              { value: preset.x_scale.start, time: 0 },
              { value: preset.x_scale.end, time: 'end' },
            ],
            y_scale: [
              { value: preset.y_scale.start, time: 0 },
              { value: preset.y_scale.end, time: 'end' },
            ],
            x: [
              { value: preset.x.start, time: 0 },
              { value: preset.x.end, time: 'end' },
            ],
            y: [
              { value: preset.y.start, time: 0 },
              { value: preset.y.end, time: 'end' },
            ],
          };
        }
      }
      this.log(`Added ${brollShots.length} B-roll images with Ken Burns effect to template modifications`);
    }

    this.log(`Template modifications: ${JSON.stringify(Object.keys(modifications))}`);

    const videoCount = Object.keys(modifications).filter(k => k.startsWith('Video-')).length;
    if (videoCount === 0) throw new Error('No video assets to compose');

    // 2b. B0.23: Pre-render validation — reject non-HTTPS asset URLs (e.g., data URIs)
    const invalidAssetSlots: string[] = [];
    for (const [slotKey, value] of Object.entries(modifications)) {
      // Only validate Video and Audio slots (string URLs or objects with source URL)
      if (!slotKey.startsWith('Video-') && !slotKey.startsWith('Audio-')) continue;
      const url = typeof value === 'string'
        ? value
        : (typeof value === 'object' && value !== null && 'source' in value && typeof (value as Record<string, unknown>).source === 'string')
          ? (value as Record<string, unknown>).source as string
          : null;
      if (!url) continue;

      if (url.startsWith('data:')) {
        invalidAssetSlots.push(slotKey);
        this.log(`Error: Asset slot "${slotKey}" has a data URI instead of an HTTPS URL — excluding from render`, { slotKey });
        await this.logEvent(projectId, 'asset_validation_error', 'editing', {
          slotKey,
          issue: 'data_uri_detected',
          urlPrefix: url.substring(0, 30),
        });
        // Remove the data URI slot so Creatomate does not receive it
        delete modifications[slotKey];
      } else if (!url.startsWith('https://')) {
        this.log(`Warning: Asset slot "${slotKey}" has a non-HTTPS URL: ${url.substring(0, 60)}`, { slotKey });
        await this.logEvent(projectId, 'asset_validation_warning', 'editing', {
          slotKey,
          issue: 'non_https_url',
          urlPrefix: url.substring(0, 60),
        });
      }
    }

    if (invalidAssetSlots.length > 0) {
      this.log(`Excluded ${invalidAssetSlots.length} invalid asset slot(s) from render: ${invalidAssetSlots.join(', ')}`);
    }

    // Re-check video count after validation
    const validVideoCount = Object.keys(modifications).filter(k => k.startsWith('Video-')).length;
    if (validVideoCount === 0) throw new Error('No valid video assets to compose after URL validation');

    // 3. Start Creatomate render + poll with retry logic
    //    2 retries with exponential backoff (15s, 30s) to protect $5-7 of prior API investment
    const maxAttempts = 3;
    const retryDelays = [15000, 30000]; // exponential backoff: 15s, 30s
    let lastError: Error | null = null;
    let finalResult: { id: string; url?: string } | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const delayMs = retryDelays[attempt - 2];
          this.log(`Retry ${attempt - 1}/${maxAttempts - 1} for Creatomate render after ${delayMs / 1000}s delay...`);
          await this.logEvent(projectId, 'render_retry', 'editing', {
            attempt,
            maxAttempts,
            error: lastError?.message ?? 'unknown',
            delayMs,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        this.log(`Starting Creatomate render (attempt ${attempt}/${maxAttempts})...`);
        const render = await this.creatomate.renderVideo({
          templateId: CREATOMATE_TEMPLATE_ID,
          modifications,
          maxWidth: RESOLUTION.width,
          maxHeight: RESOLUTION.height,
        });

        // Create asset row for final video (only on first attempt; clean up stale rows on retries)
        if (attempt === 1) {
          await this.supabase.from('asset').insert({
            project_id: projectId,
            type: 'final_video',
            provider: 'creatomate',
            provider_task_id: render.id,
            status: 'generating',
            cost_usd: API_COSTS.creatomateRender,
          });
        } else {
          // Update the existing asset row with the new render task ID
          await this.supabase
            .from('asset')
            .update({ provider_task_id: render.id, status: 'generating' })
            .eq('project_id', projectId)
            .eq('type', 'final_video')
            .eq('provider', 'creatomate');
        }

        // Poll until complete
        this.log(`Polling Creatomate render ${render.id}...`);
        const result = await this.creatomate.pollRender(render.id);

        finalResult = { id: render.id, url: result.url };
        lastError = null;
        break;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Creatomate render failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}`);
      }
    }

    if (lastError || !finalResult) {
      throw new Error(`Creatomate render failed after ${maxAttempts} attempts: ${lastError?.message ?? 'unknown error'}`);
    }

    // 4. Update asset with final URL
    await this.supabase
      .from('asset')
      .update({ url: finalResult.url || '', status: 'completed' })
      .eq('provider_task_id', finalResult.id);

    await this.trackCost(projectId, API_COSTS.creatomateRender);
    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'editing', { durationMs });
    this.log(`Editing complete for project ${projectId}: ${finalResult.url}`);
  }
}
