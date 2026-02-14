import { db } from '@/db';
import { project } from '@/db/schema';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { eq, sql } from 'drizzle-orm';

export type Database = typeof db;

export abstract class BaseAgent {
  protected db: Database;
  protected wavespeed: WaveSpeedClient;
  protected agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
    this.db = db;
    this.wavespeed = new WaveSpeedClient();
  }

  protected log(message: string): void {
    console.log(`[${this.agentName}] ${message}`);
  }

  protected async trackCost(projectId: string, amount: number): Promise<void> {
    await this.db
      .update(project)
      .set({
        costUsd: sql`${project.costUsd} + ${amount.toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(project.id, projectId));
    this.log(`Cost tracked: +$${amount.toFixed(4)} for project ${projectId}`);
  }

  abstract run(projectId: string): Promise<unknown>;
}
