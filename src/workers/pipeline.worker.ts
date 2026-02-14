import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import IORedis from 'ioredis';
import * as schema from '../db/schema';
import { ProductAnalyzerAgent } from '../agents/product-analyzer';

// Set up standalone DB connection (not using the Next.js singleton)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Set up standalone Redis connection
const connection = new IORedis(process.env.REDIS_CONNECTION_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

console.log('Pipeline worker starting...');

const worker = new Worker(
  'pipeline',
  async (job: Job) => {
    const { projectId, step } = job.data;
    console.log(`[Worker] Processing job ${job.id}: step=${step}, project=${projectId}`);

    if (step === 'product_analysis') {
      await handleProductAnalysis(projectId);
    } else {
      console.log(`[Worker] Unknown step: ${step}, skipping`);
    }
  },
  {
    connection: {
      host: connection.options.host as string,
      port: connection.options.port as number,
      password: connection.options.password,
      username: connection.options.username,
      db: connection.options.db,
      maxRetriesPerRequest: null,
    },
    concurrency: 2,
  }
);

async function handleProductAnalysis(projectId: string) {
  try {
    // Update status to analyzing
    await db
      .update(schema.project)
      .set({ status: 'analyzing', updatedAt: new Date() })
      .where(eq(schema.project.id, projectId));

    // Run the ProductAnalyzerAgent
    const agent = new ProductAnalyzerAgent();
    const analysis = await agent.run(projectId);

    // Store results
    await db
      .update(schema.project)
      .set({
        status: 'completed',
        productData: analysis,
        productName: analysis.product_name,
        productCategory: analysis.category,
        updatedAt: new Date(),
      })
      .where(eq(schema.project.id, projectId));

    console.log(`[Worker] Product analysis complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Product analysis failed for project ${projectId}:`, errorMessage);

    await db
      .update(schema.project)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.project.id, projectId));

    throw error; // Re-throw so BullMQ marks the job as failed
  }
}

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error.message);
});

worker.on('ready', () => {
  console.log('[Worker] Pipeline worker connected and ready for jobs');
});

worker.on('error', (error) => {
  console.error('[Worker] Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await pool.end();
  connection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await pool.end();
  connection.disconnect();
  process.exit(0);
});
