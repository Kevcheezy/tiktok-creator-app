import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';

export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected wavespeed: WaveSpeedClient;
  protected agentName: string;

  constructor(agentName: string, supabaseClient?: SupabaseClient) {
    this.agentName = agentName;
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.wavespeed = new WaveSpeedClient();
  }

  protected log(message: string): void {
    console.log(`[${this.agentName}] ${message}`);
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
