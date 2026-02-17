import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { createLogger, logToGenerationLog } from '@/lib/logger';
import { VideoModelConfig, getFallbackVideoModel } from '@/lib/constants';
import type pino from 'pino';

export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected wavespeed: WaveSpeedClient;
  protected agentName: string;
  protected correlationId?: string;
  protected videoModel: VideoModelConfig;
  protected shouldCancel?: () => Promise<boolean>;
  private _logger: pino.Logger;

  constructor(agentName: string, supabaseClient?: SupabaseClient) {
    this.agentName = agentName;
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.wavespeed = new WaveSpeedClient();
    this.videoModel = getFallbackVideoModel();
    this._logger = createLogger({ agentName });
  }

  /**
   * Set the video model config for this agent run.
   * Called by the pipeline worker after fetching the project's video model.
   */
  setVideoModel(config: VideoModelConfig): void {
    this.videoModel = config;
  }

  /**
   * Set a cancellation check callback for this agent run.
   * Used to abort long-running poll loops when a user cancels.
   */
  setCancelCheck(fn: () => Promise<boolean>): void {
    this.shouldCancel = fn;
  }

  /**
   * Set the correlation ID for this agent run.
   * Updates the internal logger bindings as well.
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
    this._logger = createLogger({
      agentName: this.agentName,
      correlationId,
    });
  }

  protected log(message: string, extra?: Record<string, unknown>): void {
    if (extra) {
      this._logger.info(extra, message);
    } else {
      this._logger.info(message);
    }
  }

  /**
   * Persist an event to the generation_log table.
   * Requires a projectId to be known. Fire-and-forget.
   */
  protected async logEvent(
    projectId: string,
    eventType: string,
    stage: string,
    detail: Record<string, unknown> = {}
  ): Promise<void> {
    await logToGenerationLog(this.supabase, {
      project_id: projectId,
      correlation_id: this.correlationId,
      event_type: eventType,
      agent_name: this.agentName,
      stage,
      detail,
    });
  }

  protected async trackCost(projectId: string, amount: number): Promise<void> {
    // Atomic increment via Postgres function to prevent race conditions
    // when multiple agents or regeneration calls update cost_usd concurrently
    const { data, error } = await this.supabase
      .rpc('increment_project_cost', {
        p_project_id: projectId,
        p_amount: parseFloat(amount.toFixed(4)),
      });

    if (error) {
      // Fallback to non-atomic update if RPC fails (e.g. function not yet deployed)
      this.log(`RPC increment_project_cost failed (${error.message}), falling back to non-atomic update`);
      const { data: proj } = await this.supabase
        .from('project')
        .select('cost_usd')
        .eq('id', projectId)
        .single();

      const currentCost = parseFloat(proj?.cost_usd || '0');
      await this.supabase
        .from('project')
        .update({
          cost_usd: (currentCost + amount).toFixed(4),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    }

    this.log(`Cost tracked: +$${amount.toFixed(4)} for project ${projectId} (new total: $${data ?? 'unknown'})`);
  }

  abstract run(projectId: string): Promise<unknown>;
}
