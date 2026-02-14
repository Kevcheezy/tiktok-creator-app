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
    // Fetch current cost, add amount, update
    const { data } = await this.supabase
      .from('project')
      .select('cost_usd')
      .eq('id', projectId)
      .single();

    const currentCost = parseFloat(data?.cost_usd || '0');
    await this.supabase
      .from('project')
      .update({
        cost_usd: (currentCost + amount).toFixed(4),
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    this.log(`Cost tracked: +$${amount.toFixed(4)} for project ${projectId}`);
  }

  abstract run(projectId: string): Promise<unknown>;
}
