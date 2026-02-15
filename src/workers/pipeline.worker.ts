import { config } from 'dotenv';
config({ path: '.env.local' });
import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import { ProductAnalyzerAgent } from '../agents/product-analyzer';
import { ScriptingAgent } from '../agents/scripting-agent';
import { CastingAgent } from '../agents/casting-agent';
import { DirectorAgent } from '../agents/director-agent';
import { VoiceoverAgent } from '../agents/voiceover-agent';
import { EditorAgent } from '../agents/editor-agent';
import { getPipelineQueue } from '../lib/queue';

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
    } else if (step === 'scripting') {
      await handleScripting(projectId);
    } else if (step === 'casting') {
      await handleCasting(projectId);
    } else if (step === 'directing') {
      await handleDirecting(projectId);
    } else if (step === 'voiceover') {
      await handleVoiceover(projectId);
    } else if (step === 'editing') {
      await handleEditing(projectId);
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

async function handleScripting(projectId: string) {
  try {
    // Update status to scripting
    await supabase
      .from('project')
      .update({ status: 'scripting', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    // Run the ScriptingAgent
    const agent = new ScriptingAgent(supabase);
    await agent.run(projectId);

    // Update status to script_review on success
    await supabase
      .from('project')
      .update({ status: 'script_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    console.log(`[Worker] Scripting complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Scripting failed for project ${projectId}:`, errorMessage);

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

async function handleCasting(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'casting', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new CastingAgent(supabase);
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'casting_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    console.log(`[Worker] Casting complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Casting failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleDirecting(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'directing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new DirectorAgent(supabase);
    await agent.run(projectId);

    // Auto-enqueue voiceover (no review gate between directing and voiceover)
    await getPipelineQueue().add('voiceover', {
      projectId,
      step: 'voiceover',
    });

    console.log(`[Worker] Directing complete for project ${projectId}, voiceover enqueued`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Directing failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleVoiceover(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'voiceover', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new VoiceoverAgent(supabase);
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'asset_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    console.log(`[Worker] Voiceover complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Voiceover failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleEditing(projectId: string) {
  try {
    await supabase
      .from('project')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const agent = new EditorAgent(supabase);
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    console.log(`[Worker] Editing complete for project ${projectId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Editing failed for project ${projectId}:`, errorMessage);

    await supabase
      .from('project')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
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
