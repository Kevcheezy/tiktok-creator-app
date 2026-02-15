import { config } from 'dotenv';
config({ path: '.env.local' });
import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import { ProductAnalyzerAgent } from '../agents/product-analyzer';

// Set up standalone Supabase client for the worker process
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    await supabase
      .from('project')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    // Run the ProductAnalyzerAgent
    const agent = new ProductAnalyzerAgent(supabase);
    const analysis = await agent.run(projectId);

    // Store results
    await supabase
      .from('project')
      .update({
        status: 'analysis_review',
        product_data: analysis,
        product_name: analysis.product_name,
        product_category: analysis.category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[Worker] Product analysis complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Product analysis failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

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
  connection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
});
