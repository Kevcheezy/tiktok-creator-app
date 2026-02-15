import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { CreatomateClient } from '@/lib/api-clients/creatomate';
import { CREATOMATE_TEMPLATE_ID, API_COSTS } from '@/lib/constants';

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

    // 1. Fetch all completed video and audio assets
    const { data: assets, error } = await this.supabase
      .from('asset')
      .select('*, scene:scene(segment_index)')
      .eq('project_id', projectId)
      .in('type', ['video', 'audio'])
      .eq('status', 'completed');

    if (error) throw new Error(`Failed to fetch assets: ${error.message}`);
    if (!assets || assets.length === 0) throw new Error('No completed assets found');

    // 2. Build modifications map for Creatomate template
    const modifications: Record<string, string> = {};

    for (const asset of assets) {
      const segIdx = asset.scene?.segment_index;
      if (segIdx === null || segIdx === undefined) continue;
      if (!asset.url) continue;

      const slotNum = segIdx + 1;

      if (asset.type === 'video') {
        modifications[`Video-${slotNum}`] = asset.url;
      } else if (asset.type === 'audio') {
        modifications[`Audio-${slotNum}`] = asset.url;
      }
    }

    this.log(`Template modifications: ${JSON.stringify(Object.keys(modifications))}`);

    const videoCount = Object.keys(modifications).filter(k => k.startsWith('Video-')).length;
    if (videoCount === 0) throw new Error('No video assets to compose');

    // 3. Start Creatomate render
    this.log('Starting Creatomate render...');
    const render = await this.creatomate.renderVideo({
      templateId: CREATOMATE_TEMPLATE_ID,
      modifications,
    });

    // 4. Create asset row for final video
    await this.supabase.from('asset').insert({
      project_id: projectId,
      type: 'final_video',
      provider: 'creatomate',
      provider_task_id: render.id,
      status: 'generating',
      cost_usd: API_COSTS.creatomateRender,
    });

    // 5. Poll until complete
    this.log(`Polling Creatomate render ${render.id}...`);
    const result = await this.creatomate.pollRender(render.id);

    // 6. Update asset with final URL
    await this.supabase
      .from('asset')
      .update({ url: result.url || '', status: 'completed' })
      .eq('provider_task_id', render.id);

    await this.trackCost(projectId, API_COSTS.creatomateRender);
    const durationMs = Date.now() - stageStart;
    await this.logEvent(projectId, 'stage_complete', 'editing', { durationMs });
    this.log(`Editing complete for project ${projectId}: ${result.url}`);
  }
}
