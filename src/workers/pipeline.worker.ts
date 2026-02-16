import { config } from 'dotenv';
// Load .env.local for local dev; Railway/production sets env vars directly
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
import { BRollAgent } from '../agents/broll-agent';
import { VideoAnalysisAgent } from '../agents/video-analysis-agent';
import { WaveSpeedClient } from '../lib/api-clients/wavespeed';
import { ElevenLabsClient } from '../lib/api-clients/elevenlabs';
import { FALLBACK_VOICES, API_COSTS, VideoModelConfig, getFallbackVideoModel, PRODUCT_PLACEMENT_ARC, VISIBILITY_ANGLE_MAP, RESOLUTION } from '../lib/constants';
import { isStructuredPrompt, resolveNegativePrompt } from '../lib/prompt-schema';
import { serializeForImage, serializeForVideo } from '../lib/prompt-serializer';
import { getPipelineQueue } from '../lib/queue';
import { APP_VERSION, GIT_COMMIT } from '../lib/version';
import { createLogger, logToGenerationLog } from '../lib/logger';
import crypto from 'crypto';

// Worker-level logger
const log = createLogger({ agentName: 'PipelineWorker' });

// Set up standalone Supabase client for the worker process
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Set up standalone Redis connection
const redisUrl = process.env.REDIS_CONNECTION_URL || 'redis://localhost:6379';
const parsedRedis = new URL(redisUrl);
const isLocalhost = parsedRedis.hostname === 'localhost' || parsedRedis.hostname === '127.0.0.1';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  ...(isLocalhost ? {} : { tls: {} }),
});

/**
 * Fetch the video model config for a project. Falls back to hardcoded constants
 * if the project has no video_model_id (pre-migration projects).
 */
async function getVideoModelForProject(projectId: string): Promise<VideoModelConfig> {
  const { data: proj } = await supabase
    .from('project')
    .select('video_model_id')
    .eq('id', projectId)
    .single();

  if (proj?.video_model_id) {
    const { data: vm } = await supabase
      .from('video_model')
      .select('*')
      .eq('id', proj.video_model_id)
      .single();

    if (vm) return vm as VideoModelConfig;
  }

  return getFallbackVideoModel();
}

log.info({ version: APP_VERSION, commit: GIT_COMMIT }, 'Pipeline worker starting');

const worker = new Worker(
  'pipeline',
  async (job: Job) => {
    const { projectId, productId, step } = job.data;
    const correlationId = crypto.randomUUID();
    const jobLog = createLogger({ agentName: 'PipelineWorker', jobId: job.id, correlationId, projectId: projectId || productId });

    jobLog.info({ step, projectId, productId }, 'Processing job');

    if (step === 'product_analysis') {
      await handleProductAnalysis(projectId, correlationId, jobLog, productId);
    } else if (step === 'scripting') {
      await handleScripting(projectId, correlationId, jobLog);
    } else if (step === 'casting') {
      await handleCasting(projectId, correlationId, jobLog);
    } else if (step === 'directing') {
      await handleDirecting(projectId, correlationId, jobLog);
    } else if (step === 'voiceover') {
      await handleVoiceover(projectId, correlationId, jobLog);
    } else if (step === 'broll_planning') {
      await handleBrollPlanning(projectId, correlationId, jobLog);
    } else if (step === 'broll_generation') {
      await handleBrollGeneration(projectId, correlationId, jobLog);
    } else if (step === 'editing') {
      await handleEditing(projectId, correlationId, jobLog);
    } else if (step === 'regenerate_asset') {
      await handleAssetRegeneration(projectId, job.data.assetId, correlationId, jobLog);
    } else if (step === 'regenerate_asset_cascade') {
      await handleCascadeRegeneration(projectId, job.data.assetId, correlationId, jobLog);
    } else if (step === 'keyframe_edit') {
      await handleKeyframeEdit(projectId!, job.data.assetId!, job.data.editPrompt!, job.data.propagate || false, correlationId, jobLog);
    } else {
      jobLog.warn({ step }, 'Unknown step, skipping');
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
      ...(isLocalhost ? {} : { tls: {} }),
    },
    concurrency: 2,
  }
);

async function handleProductAnalysis(projectId: string | undefined, correlationId: string, jobLog: ReturnType<typeof createLogger>, productId?: string) {
  const stage = 'analyzing';
  const stageStart = Date.now();

  // Standalone product analysis (no project) — triggered by POST /api/products
  if (!projectId && productId) {
    try {
      await logToGenerationLog(supabase, {
        project_id: productId, correlation_id: correlationId,
        event_type: 'stage_start', agent_name: 'ProductAnalyzerAgent', stage,
      });

      // Fetch product URL to build a temporary project-like object for the agent
      const { data: prod } = await supabase.from('product').select('*').eq('id', productId).single();
      if (!prod) throw new Error(`Product not found: ${productId}`);

      const agent = new ProductAnalyzerAgent(supabase);
      agent.setCorrelationId(correlationId);

      // Create a temporary project for the agent to analyze
      // The agent reads product_url from the project, so we pass it through
      const { data: tempProject } = await supabase
        .from('project')
        .insert({
          product_id: productId,
          product_url: prod.url,
          status: 'analyzing',
          name: `_temp_analysis_${productId}`,
        })
        .select()
        .single();

      if (!tempProject) throw new Error('Failed to create temp project for analysis');

      const analysis = await agent.run(tempProject.id);

      // Write to product table (respecting overrides)
      await writeAnalysisToProduct(productId, analysis, jobLog);

      // Clean up temp project
      await supabase.from('project').delete().eq('id', tempProject.id);

      const durationMs = Date.now() - stageStart;
      await logToGenerationLog(supabase, {
        project_id: productId, correlation_id: correlationId,
        event_type: 'stage_complete', agent_name: 'ProductAnalyzerAgent', stage,
        detail: { durationMs },
      });
      jobLog.info({ durationMs, productId }, 'Standalone product analysis complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      jobLog.error({ err: error, productId }, 'Standalone product analysis failed');

      await supabase
        .from('product')
        .update({ status: 'failed', error_message: errorMessage, updated_at: new Date().toISOString() })
        .eq('id', productId);

      throw error;
    }
    return;
  }

  // Standard project-linked analysis
  try {
    await supabase
      .from('project')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId!, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'ProductAnalyzerAgent', stage,
    });

    // Check if project has a video_url for parallel video analysis
    const { data: projCheck } = await supabase
      .from('project')
      .select('video_url')
      .eq('id', projectId)
      .single();

    const agent = new ProductAnalyzerAgent(supabase);
    agent.setCorrelationId(correlationId);
    const productAnalysisPromise = agent.run(projectId!);

    let videoAnalysisPromise: Promise<unknown> | null = null;
    if (projCheck?.video_url) {
      jobLog.info('Video URL detected, running VideoAnalysisAgent in parallel');
      const videoAgent = new VideoAnalysisAgent(supabase);
      videoAgent.setCorrelationId(correlationId);
      videoAnalysisPromise = videoAgent.run(projectId!);
    }

    const tasks: Promise<unknown>[] = [productAnalysisPromise];
    if (videoAnalysisPromise) tasks.push(videoAnalysisPromise);

    const results = await Promise.allSettled(tasks);

    // Product analysis failure = pipeline failure
    if (results[0].status === 'rejected') {
      throw results[0].reason;
    }
    const analysis = (results[0] as PromiseFulfilledResult<any>).value;

    // Video analysis failure = log warning, continue
    if (results.length > 1 && results[1].status === 'rejected') {
      jobLog.warn({ err: results[1].reason }, 'Video analysis failed (non-blocking), continuing pipeline');
    }

    // Write to product table if project has a product_id
    const { data: proj } = await supabase
      .from('project')
      .select('product_id')
      .eq('id', projectId)
      .single();

    if (proj?.product_id) {
      await writeAnalysisToProduct(proj.product_id, analysis, jobLog);
    }

    // Write denormalized fields to project (backward compat)
    const updateData: Record<string, unknown> = {
      status: 'analysis_review',
      product_data: analysis,
      product_name: analysis.product_name,
      product_category: analysis.category,
      updated_at: new Date().toISOString(),
    };
    if (analysis.product_image_url) {
      updateData.product_image_url = analysis.product_image_url;
    }

    await supabase
      .from('project')
      .update(updateData)
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId!, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'ProductAnalyzerAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Product analysis complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Product analysis failed');

    await logToGenerationLog(supabase, {
      project_id: projectId!, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'ProductAnalyzerAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'analyzing',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Also mark product as failed if linked
    if (productId) {
      await supabase
        .from('product')
        .update({ status: 'failed', error_message: errorMessage, updated_at: new Date().toISOString() })
        .eq('id', productId);
    }

    throw error;
  }
}

/**
 * Write analysis results to the product table, respecting user overrides.
 */
async function writeAnalysisToProduct(
  productId: string,
  analysis: import('../agents/product-analyzer').ProductAnalysis,
  jobLog: ReturnType<typeof createLogger>
) {
  const { data: existing } = await supabase
    .from('product')
    .select('overrides')
    .eq('id', productId)
    .single();

  const overrides = (existing?.overrides || {}) as Record<string, boolean>;

  const productUpdate: Record<string, unknown> = {
    analysis_data: analysis,
    status: 'analyzed',
    cost_usd: API_COSTS.wavespeedChat,
    updated_at: new Date().toISOString(),
  };

  // Map analysis fields to product columns, skip overridden ones
  const fieldMap: [string, unknown][] = [
    ['name', analysis.product_name],
    ['brand', analysis.brand],
    ['category', analysis.category],
    ['product_type', analysis.product_type],
    ['product_size', analysis.product_size],
    ['product_price', analysis.product_price],
    ['selling_points', analysis.selling_points],
    ['key_claims', analysis.key_claims],
    ['benefits', analysis.benefits],
    ['usage', analysis.usage],
    ['hook_angle', analysis.hook_angle],
    ['avatar_description', analysis.avatar_description],
    ['image_description', analysis.image_description_for_nano_banana_pro],
  ];

  for (const [field, value] of fieldMap) {
    if (!overrides[field]) {
      productUpdate[field] = value;
    } else {
      jobLog.info({ field, productId }, 'Skipping overridden field on reanalyze');
    }
  }

  if (analysis.product_image_url && !overrides['image_url']) {
    productUpdate.image_url = analysis.product_image_url;
  }

  await supabase
    .from('product')
    .update(productUpdate)
    .eq('id', productId);

  jobLog.info({ productId }, 'Product table updated with analysis');

  // Seed product_image table for multi-angle support (R2.4)
  if (analysis.product_image_url) {
    const { data: existingImages } = await supabase
      .from('product_image')
      .select('id')
      .eq('product_id', productId)
      .limit(1);

    if (!existingImages || existingImages.length === 0) {
      await supabase.from('product_image').insert({
        product_id: productId,
        url: analysis.product_image_url,
        angle: 'front',
        is_primary: true,
        sort_order: 0,
      });
      jobLog.info({ productId }, 'Auto-created product_image from analysis');
    }
  }
}

async function handleScripting(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'scripting';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'scripting', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'ScriptingAgent', stage,
    });

    const agent = new ScriptingAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'script_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'ScriptingAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Scripting complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Scripting failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'ScriptingAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'scripting',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleCasting(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'casting';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'casting', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'CastingAgent', stage,
    });

    const agent = new CastingAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'casting_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'CastingAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Casting complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Casting failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'CastingAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'casting',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleDirecting(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'directing';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'directing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'DirectorAgent', stage,
    });

    const agent = new DirectorAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.run(projectId);

    // Auto-enqueue voiceover (no review gate between directing and voiceover)
    await getPipelineQueue().add('voiceover', {
      projectId,
      step: 'voiceover',
    });

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'DirectorAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Directing complete, voiceover enqueued');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Directing failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'DirectorAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'directing',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleVoiceover(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'voiceover';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'voiceover', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'VoiceoverAgent', stage,
    });

    const agent = new VoiceoverAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.run(projectId);

    // Auto-enqueue B-roll generation (runs before asset review)
    await getPipelineQueue().add('broll_generation', {
      projectId,
      step: 'broll_generation',
    });

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'VoiceoverAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Voiceover complete, B-roll generation enqueued');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Voiceover failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'VoiceoverAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'voiceover',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleEditing(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'editing';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'EditorAgent', stage,
    });

    const agent = new EditorAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'EditorAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Editing complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Editing failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'EditorAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'editing',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleBrollPlanning(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'broll_planning';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'broll_planning', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'BRollAgent', stage,
    });

    const agent = new BRollAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.plan(projectId);

    await supabase
      .from('project')
      .update({ status: 'broll_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'BRollAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'B-roll planning complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'B-roll planning failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'BRollAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'broll_planning',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleBrollGeneration(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'broll_generation';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'broll_generation', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'BRollAgent', stage,
    });

    const agent = new BRollAgent(supabase);
    agent.setCorrelationId(correlationId);
    agent.setVideoModel(await getVideoModelForProject(projectId));
    await agent.generate(projectId);

    await supabase
      .from('project')
      .update({ status: 'asset_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'BRollAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'B-roll generation complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'B-roll generation failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_error', agent_name: 'BRollAgent', stage,
      detail: { error: errorMessage, durationMs },
    });

    await supabase
      .from('project')
      .update({
        status: 'failed',
        failed_at_status: 'broll_generation',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    throw error;
  }
}

async function handleAssetRegeneration(
  projectId: string,
  assetId: string,
  correlationId: string,
  jobLog: ReturnType<typeof createLogger>
) {
  const regenStart = Date.now();
  try {
    // Fetch asset with its scene
    const { data: asset, error: assetError } = await supabase
      .from('asset')
      .select('*, scene:scene(*)')
      .eq('id', assetId)
      .single();

    if (assetError || !asset) throw new Error(`Asset ${assetId} not found`);

    jobLog.info({ assetId, type: asset.type }, 'Regenerating asset');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'asset_regenerate_start', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { assetId, type: asset.type },
    });

    if (asset.type === 'keyframe_start' || asset.type === 'keyframe_end') {
      await regenerateKeyframe(projectId, assetId, asset, jobLog);
    } else if (asset.type === 'video') {
      await regenerateVideo(projectId, assetId, asset, jobLog);
    } else if (asset.type === 'audio') {
      await regenerateAudio(projectId, assetId, asset, jobLog);
    } else {
      throw new Error(`Unsupported asset type for regeneration: ${asset.type}`);
    }

    const durationMs = Date.now() - regenStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'asset_regenerate_complete', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { assetId, type: asset.type, durationMs },
    });
    jobLog.info({ assetId, durationMs }, 'Asset regeneration complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLog.error({ assetId, err: error }, 'Asset regeneration failed');

    // Store error message in metadata for frontend display
    const { data: failedAsset } = await supabase
      .from('asset').select('metadata').eq('id', assetId).single();
    await supabase
      .from('asset')
      .update({
        status: 'failed',
        metadata: { ...(failedAsset?.metadata || {}), lastRegenError: errorMessage },
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'asset_regenerate_error', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { assetId, error: errorMessage },
    });

    throw error;
  }
}

async function regenerateKeyframe(
  projectId: string,
  assetId: string,
  asset: any,
  jobLog: ReturnType<typeof createLogger>,
  previousFrameUrl?: string | null,
): Promise<string> {
  const scene = Array.isArray(asset.scene) ? asset.scene[0] : asset.scene;
  const visualPrompt = scene?.visual_prompt as { start: unknown; end: unknown } | null;
  const rawPrompt = asset.type === 'keyframe_start'
    ? visualPrompt?.start
    : visualPrompt?.end;

  if (!rawPrompt) throw new Error('No visual prompt found on scene for regeneration');

  // Serialize structured prompts; pass through legacy strings
  const promptText = isStructuredPrompt(rawPrompt) ? serializeForImage(rawPrompt) : String(rawPrompt);

  // Fetch project with influencer + product for reference images
  const { data: project } = await supabase
    .from('project')
    .select('*, influencer:influencer(*), product:product(*)')
    .eq('id', projectId)
    .single();

  // Build reference images matching CastingAgent pattern:
  // [previousEndFrame, influencerImage, productImage]
  const referenceImages: string[] = [];

  // 1. Previous frame in chain (passed from cascade, or fetched for single regen)
  if (previousFrameUrl) {
    referenceImages.push(previousFrameUrl);
  } else if (asset.type === 'keyframe_end' && scene) {
    // For END keyframe: use same segment's START as reference
    const { data: startAsset } = await supabase
      .from('asset')
      .select('url')
      .eq('scene_id', scene.id)
      .eq('type', 'keyframe_start')
      .eq('status', 'completed')
      .single();
    if (startAsset?.url) referenceImages.push(startAsset.url);
  } else if (asset.type === 'keyframe_start' && scene) {
    // For START keyframe: use previous segment's END as reference (chaining)
    const segmentIndex = scene.segment_index ?? 0;
    if (segmentIndex > 0) {
      const { data: prevEndAsset } = await supabase
        .from('asset')
        .select('url, scene:scene(segment_index)')
        .eq('project_id', projectId)
        .eq('type', 'keyframe_end')
        .eq('status', 'completed');
      const prevEnd = (prevEndAsset || []).find((a: any) => {
        const s = Array.isArray(a.scene) ? a.scene[0] : a.scene;
        return s?.segment_index === segmentIndex - 1;
      });
      if (prevEnd?.url) referenceImages.push(prevEnd.url);
    }
  }

  // 2. Influencer image
  if (project?.influencer?.image_url) {
    referenceImages.push(project.influencer.image_url);
  }

  // 3. Product image (angle-aware, matching CastingAgent pattern)
  const productId = project?.product_id || project?.product?.id;
  if (productId) {
    const segmentIndex = scene?.segment_index ?? 0;
    const placement = PRODUCT_PLACEMENT_ARC[segmentIndex];
    if (placement && placement.visibility !== 'none') {
      const { data: productImages } = await supabase
        .from('product_image')
        .select('url, url_clean, angle, is_primary')
        .eq('product_id', productId)
        .order('sort_order');
      const imgs = productImages || [];
      if (imgs.length > 0) {
        const preferredAngles = VISIBILITY_ANGLE_MAP[placement.visibility] || ['front'];
        let productUrl: string | null = null;
        for (const angle of preferredAngles) {
          const match = imgs.find((i: any) => i.angle === angle);
          if (match) { productUrl = match.url_clean || match.url; break; }
        }
        if (!productUrl) {
          const primary = imgs.find((i: any) => i.is_primary);
          productUrl = primary ? (primary.url_clean || primary.url) : (imgs[0].url_clean || imgs[0].url);
        }
        if (productUrl) referenceImages.push(productUrl);
      } else if (project?.product?.image_url) {
        referenceImages.push(project.product.image_url);
      }
    }
  }

  const wavespeed = new WaveSpeedClient();
  let taskId: string;
  let cost: number;
  const editOpts = { aspectRatio: RESOLUTION.aspectRatio, resolution: '1k' as const };

  if (referenceImages.length > 0) {
    const refLabels = referenceImages.map((_, i) => i === 0 ? 'primary_ref' : `ref_${i}`).join('+');
    jobLog.info({ refs: refLabels, refCount: referenceImages.length }, 'Regenerating keyframe via image edit');
    const result = await wavespeed.editImage(referenceImages, promptText, editOpts);
    taskId = result.taskId;
    cost = API_COSTS.nanoBananaProEdit;
  } else {
    jobLog.info('Regenerating keyframe via text-to-image (no references)');
    const result = await wavespeed.generateImage(promptText);
    taskId = result.taskId;
    cost = API_COSTS.nanoBananaPro;
  }

  jobLog.info({ taskId }, 'Polling keyframe result');
  const pollResult = await wavespeed.pollResult(taskId, { maxWait: 240000, initialInterval: 5000 });
  const newUrl = pollResult.url || '';

  await supabase
    .from('asset')
    .update({
      url: newUrl,
      status: 'completed',
      provider_task_id: taskId,
      cost_usd: cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  // Track cost (increment project total)
  const { data: proj } = await supabase
    .from('project')
    .select('cost_usd')
    .eq('id', projectId)
    .single();
  const currentCost = parseFloat(proj?.cost_usd || '0');
  await supabase
    .from('project')
    .update({ cost_usd: (currentCost + cost).toFixed(4), updated_at: new Date().toISOString() })
    .eq('id', projectId);

  return newUrl;
}

/**
 * Cascade keyframe regeneration: regenerates the target keyframe, then walks
 * forward through all subsequent keyframes in chain order, passing each
 * newly generated frame as the primary reference to the next.
 *
 * Chain order: Seg0 START → Seg0 END → Seg1 START → Seg1 END → ...
 */
async function handleCascadeRegeneration(
  projectId: string,
  sourceAssetId: string,
  correlationId: string,
  jobLog: ReturnType<typeof createLogger>
) {
  const cascadeStart = Date.now();
  jobLog.info({ sourceAssetId }, 'Starting cascade keyframe regeneration');

  try {
    // Fetch the source asset with scene
    const { data: sourceAsset, error: sourceErr } = await supabase
      .from('asset')
      .select('*, scene:scene(*)')
      .eq('id', sourceAssetId)
      .single();

    if (sourceErr || !sourceAsset) throw new Error(`Source asset ${sourceAssetId} not found`);

    const sourceScene = Array.isArray(sourceAsset.scene) ? sourceAsset.scene[0] : sourceAsset.scene;
    const sourceSegment = sourceScene?.segment_index ?? 0;
    const sourceIsStart = sourceAsset.type === 'keyframe_start';

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'cascade_regen_start', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { sourceAssetId, sourceSegment, sourceType: sourceAsset.type },
    });

    // Fetch ALL keyframe assets for this project, ordered by segment + type
    const { data: allKeyframes } = await supabase
      .from('asset')
      .select('*, scene:scene(id, segment_index)')
      .eq('project_id', projectId)
      .in('type', ['keyframe_start', 'keyframe_end']);

    // Build ordered chain: [seg0_start, seg0_end, seg1_start, seg1_end, ...]
    const ordered = (allKeyframes || [])
      .map((kf: any) => {
        const s = Array.isArray(kf.scene) ? kf.scene[0] : kf.scene;
        return { ...kf, _seg: s?.segment_index ?? 0, _ord: kf.type === 'keyframe_start' ? 0 : 1 };
      })
      .sort((a: any, b: any) => a._seg - b._seg || a._ord - b._ord);

    // Find the source asset's position in the chain
    const sourceIdx = ordered.findIndex((kf: any) => kf.id === sourceAssetId);
    if (sourceIdx === -1) throw new Error('Source asset not found in keyframe chain');

    // The cascade includes the source and everything after it
    const cascadeChain = ordered.slice(sourceIdx);

    jobLog.info({ chainLength: cascadeChain.length, sourceSegment, sourceIsStart }, 'Cascade chain built');

    // Walk the chain: each frame uses the previous output as primary reference
    let previousUrl: string | null = null;

    // If source is an END keyframe, get same segment's START as initial reference
    // If source is a START keyframe of seg > 0, get previous segment's END
    if (!sourceIsStart) {
      const sameSegStart = ordered.find((kf: any) => kf._seg === sourceSegment && kf.type === 'keyframe_start');
      previousUrl = sameSegStart?.url || null;
    } else if (sourceSegment > 0) {
      const prevSegEnd = ordered.find((kf: any) => kf._seg === sourceSegment - 1 && kf.type === 'keyframe_end');
      previousUrl = prevSegEnd?.url || null;
    }

    let regeneratedCount = 0;

    for (let i = 0; i < cascadeChain.length; i++) {
      const kf = cascadeChain[i];
      try {
        jobLog.info({ assetId: kf.id, segment: kf._seg, type: kf.type, previousUrl: !!previousUrl }, 'Cascade: regenerating keyframe');

        const newUrl = await regenerateKeyframe(projectId, kf.id, kf, jobLog, previousUrl);
        previousUrl = newUrl;
        regeneratedCount++;

        jobLog.info({ assetId: kf.id, segment: kf._seg, type: kf.type }, 'Cascade: keyframe regenerated');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        jobLog.error({ assetId: kf.id, err }, 'Cascade: keyframe regeneration failed, stopping cascade');

        // Mark the failed keyframe
        await supabase
          .from('asset')
          .update({
            status: 'failed',
            metadata: { ...(kf.metadata || {}), lastRegenError: errorMessage },
            updated_at: new Date().toISOString(),
          })
          .eq('id', kf.id);

        // Mark all remaining keyframes in the chain as failed
        const remainingIds = cascadeChain.slice(i + 1).map((r: any) => r.id);
        if (remainingIds.length > 0) {
          jobLog.info({ remainingCount: remainingIds.length }, 'Marking remaining cascade keyframes as failed');
          await supabase
            .from('asset')
            .update({
              status: 'failed',
              metadata: { lastRegenError: `Cascade stopped: upstream keyframe ${kf.id} failed` },
              updated_at: new Date().toISOString(),
            })
            .in('id', remainingIds);
        }

        // Stop the cascade — subsequent frames cannot be generated without a valid reference
        break;
      }
    }

    const durationMs = Date.now() - cascadeStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'cascade_regen_complete', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { sourceAssetId, regeneratedCount, totalInChain: cascadeChain.length, durationMs },
    });

    jobLog.info({ regeneratedCount, totalInChain: cascadeChain.length, durationMs }, 'Cascade regeneration complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLog.error({ sourceAssetId, err: error }, 'Cascade regeneration failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'cascade_regen_error', agent_name: 'PipelineWorker',
      stage: 'regeneration',
      detail: { sourceAssetId, error: errorMessage },
    });

    throw error;
  }
}

async function regenerateVideo(
  projectId: string,
  assetId: string,
  asset: any,
  jobLog: ReturnType<typeof createLogger>
) {
  const scene = asset.scene;
  if (!scene) throw new Error('Scene not found for video asset');

  // Get keyframe URLs for this scene
  const { data: keyframes } = await supabase
    .from('asset')
    .select('*')
    .eq('scene_id', scene.id)
    .in('type', ['keyframe_start', 'keyframe_end'])
    .eq('status', 'completed');

  const startKf = keyframes?.find((a: any) => a.type === 'keyframe_start');
  const endKf = keyframes?.find((a: any) => a.type === 'keyframe_end');

  if (!startKf?.url) throw new Error('Start keyframe required for video regeneration');

  // Fetch project for negative prompt override
  const { data: project } = await supabase
    .from('project')
    .select('negative_prompt_override')
    .eq('id', projectId)
    .single();

  const negativePrompt = resolveNegativePrompt(project, 'directing');

  // Check for structured visual_prompt on scene
  const visualPrompt = scene.visual_prompt as { start: unknown; end: unknown } | null;
  const hasStructured = visualPrompt && isStructuredPrompt(visualPrompt.start);

  let mainPrompt: string;
  let multiPrompt: Array<{ prompt: string; duration: string }>;
  let effectiveNegativePrompt: string;

  if (hasStructured) {
    // Use serializer for structured prompts
    const serialized = serializeForVideo(visualPrompt.start as import('../lib/prompt-schema').StructuredPrompt, '5');
    mainPrompt = serialized.prompt;
    multiPrompt = serialized.multiPrompt;
    effectiveNegativePrompt = serialized.negativePrompt;
  } else {
    // Legacy fallback: string concatenation
    const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
    multiPrompt = (shotScripts || []).map((shot: any) => ({
      prompt: `${shot.text}. Energy: ${shot.energy}. Camera follows subject naturally.`,
      duration: '5',
    }));
    mainPrompt = [
      scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
      scene.section ? `Section: ${scene.section}` : '',
      'Natural movement, professional lighting, TikTok style video, 9:16 portrait',
    ].filter(Boolean).join('. ');
    effectiveNegativePrompt = negativePrompt;
  }

  const wavespeed = new WaveSpeedClient();
  const result = await wavespeed.generateVideo({
    image: startKf.url,
    tailImage: endKf?.url,
    prompt: mainPrompt,
    negativePrompt: effectiveNegativePrompt,
    multiPrompt,
    duration: 15,
    cfgScale: 0.5,
  });

  jobLog.info({ taskId: result.taskId }, 'Polling video result');
  const pollResult = await wavespeed.pollResult(result.taskId);

  await supabase
    .from('asset')
    .update({
      url: pollResult.url || '',
      status: 'completed',
      provider_task_id: result.taskId,
      cost_usd: API_COSTS.klingVideo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  const { data: proj } = await supabase
    .from('project')
    .select('cost_usd')
    .eq('id', projectId)
    .single();
  const currentCost = parseFloat(proj?.cost_usd || '0');
  await supabase
    .from('project')
    .update({ cost_usd: (currentCost + API_COSTS.klingVideo).toFixed(4), updated_at: new Date().toISOString() })
    .eq('id', projectId);
}

async function regenerateAudio(
  projectId: string,
  assetId: string,
  asset: any,
  jobLog: ReturnType<typeof createLogger>
) {
  const scene = asset.scene;
  if (!scene?.script_text) throw new Error('Script text required for audio regeneration');

  // Get the character's voice_id or use fallback
  const { data: project } = await supabase
    .from('project')
    .select('*, character:ai_character(*)')
    .eq('id', projectId)
    .single();

  const voiceId = project?.character?.voice_id || FALLBACK_VOICES.male.voiceId;

  const elevenlabs = new ElevenLabsClient();
  jobLog.info({ voiceId }, 'Regenerating audio');
  const audioBuffer = await elevenlabs.textToSpeech(voiceId, scene.script_text);

  // Upload to Supabase Storage
  const fileName = `projects/${projectId}/audio/segment-${scene.segment_index}-regen-${Date.now()}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

  let audioUrl: string;
  if (uploadError) {
    jobLog.warn({ err: uploadError }, 'Storage upload failed, using data URI');
    const base64 = audioBuffer.toString('base64');
    audioUrl = `data:audio/mpeg;base64,${base64}`;
  } else {
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(fileName);
    audioUrl = urlData.publicUrl;
  }

  await supabase
    .from('asset')
    .update({
      url: audioUrl,
      status: 'completed',
      cost_usd: API_COSTS.elevenLabsTts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  const { data: proj } = await supabase
    .from('project')
    .select('cost_usd')
    .eq('id', projectId)
    .single();
  const currentCost = parseFloat(proj?.cost_usd || '0');
  await supabase
    .from('project')
    .update({ cost_usd: (currentCost + API_COSTS.elevenLabsTts).toFixed(4), updated_at: new Date().toISOString() })
    .eq('id', projectId);
}

async function handleKeyframeEdit(
  projectId: string,
  assetId: string,
  editPrompt: string,
  propagate: boolean,
  correlationId: string,
  jobLog: ReturnType<typeof createLogger>,
) {
  const editStart = Date.now();
  const wavespeed = new WaveSpeedClient();

  try {
    await logToGenerationLog(supabase, {
      project_id: projectId,
      correlation_id: correlationId,
      event_type: 'keyframe_edit_start',
      agent_name: 'PipelineWorker',
      stage: 'keyframe_edit',
      detail: { assetId, propagate, editPrompt },
    });

    if (!propagate) {
      await editSingleKeyframe(projectId, assetId, editPrompt, wavespeed, jobLog);
    } else {
      const sourceAsset = await fetchAssetWithScene(assetId);
      if (!sourceAsset) throw new Error(`Source asset ${assetId} not found`);

      const sourceSegment = sourceAsset.scene?.segment_index ?? -1;
      const sourceIsStart = sourceAsset.type === 'keyframe_start';

      const { data: editingAssets } = await supabase
        .from('asset')
        .select('id, type, url, status, scene_id, scene:scene(segment_index)')
        .eq('project_id', projectId)
        .in('type', ['keyframe_start', 'keyframe_end'])
        .eq('status', 'editing');

      const subsequent = (editingAssets || []).filter((kf: any) => {
        const sceneData = Array.isArray(kf.scene) ? kf.scene[0] : kf.scene;
        const seg = sceneData?.segment_index ?? -1;
        if (seg > sourceSegment) return true;
        if (seg === sourceSegment && sourceIsStart && kf.type === 'keyframe_end') return true;
        return false;
      });

      jobLog.info({ count: subsequent.length }, 'Propagating edit to subsequent keyframes');

      for (const kf of subsequent) {
        try {
          if (!kf.url) {
            jobLog.warn({ assetId: kf.id }, 'Subsequent keyframe has no URL, skipping');
            await supabase
              .from('asset')
              .update({ status: 'failed', updated_at: new Date().toISOString() })
              .eq('id', kf.id);
            continue;
          }
          await editSingleKeyframe(projectId, kf.id, editPrompt, wavespeed, jobLog);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          jobLog.error({ assetId: kf.id, err }, 'Failed to edit subsequent keyframe');
          // Fetch existing metadata to preserve, then store error for frontend display
          const { data: failedKf } = await supabase
            .from('asset')
            .select('metadata')
            .eq('id', kf.id)
            .single();
          const kfMeta = (failedKf?.metadata || {}) as Record<string, unknown>;
          await supabase
            .from('asset')
            .update({
              status: 'failed',
              metadata: { ...kfMeta, lastEditError: errMsg },
              updated_at: new Date().toISOString(),
            })
            .eq('id', kf.id);
          await logToGenerationLog(supabase, {
            project_id: projectId,
            correlation_id: correlationId,
            event_type: 'keyframe_edit_error',
            agent_name: 'PipelineWorker',
            stage: 'keyframe_edit',
            detail: { assetId: kf.id, error: errMsg },
          });
        }
      }
    }

    const durationMs = Date.now() - editStart;
    await logToGenerationLog(supabase, {
      project_id: projectId,
      correlation_id: correlationId,
      event_type: 'keyframe_edit_complete',
      agent_name: 'PipelineWorker',
      stage: 'keyframe_edit',
      detail: { assetId, propagate, durationMs },
    });
    jobLog.info({ durationMs, propagate }, 'Keyframe edit complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLog.error({ assetId, err: error }, 'Keyframe edit failed');

    // Fetch existing metadata to preserve edit history, then store the error
    const { data: failedAsset } = await supabase
      .from('asset')
      .select('metadata')
      .eq('id', assetId)
      .single();
    const existingMeta = (failedAsset?.metadata || {}) as Record<string, unknown>;

    await supabase
      .from('asset')
      .update({
        status: 'failed',
        metadata: { ...existingMeta, lastEditError: errorMessage },
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    await logToGenerationLog(supabase, {
      project_id: projectId,
      correlation_id: correlationId,
      event_type: 'keyframe_edit_error',
      agent_name: 'PipelineWorker',
      stage: 'keyframe_edit',
      detail: { assetId, error: errorMessage },
    });

    throw error;
  }
}

async function editSingleKeyframe(
  projectId: string,
  assetId: string,
  editPrompt: string,
  wavespeed: WaveSpeedClient,
  jobLog: ReturnType<typeof createLogger>,
) {
  const { data: asset, error } = await supabase
    .from('asset')
    .select('id, url, metadata')
    .eq('id', assetId)
    .single();

  if (error || !asset?.url) throw new Error(`Asset ${assetId} has no URL to edit`);

  jobLog.info({ assetId }, 'Editing keyframe via Nano Banana Pro Edit');

  const result = await wavespeed.editImage(
    [asset.url],
    editPrompt,
    { aspectRatio: '9:16', resolution: '1k' },
  );

  jobLog.info({ assetId, taskId: result.taskId }, 'Polling keyframe edit result');
  const pollResult = await wavespeed.pollResult(result.taskId, {
    maxWait: 240000,
    initialInterval: 5000,
  });

  const existingMeta = (asset.metadata || {}) as Record<string, unknown>;
  const editHistory = (existingMeta.editHistory || []) as Array<Record<string, unknown>>;
  editHistory.push({
    prompt: editPrompt,
    previousUrl: asset.url,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from('asset')
    .update({
      url: pollResult.url || '',
      status: 'completed',
      provider_task_id: result.taskId,
      cost_usd: API_COSTS.nanoBananaProEdit,
      metadata: { ...existingMeta, editHistory, lastEditPrompt: editPrompt },
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId);

  const { data: proj } = await supabase
    .from('project')
    .select('cost_usd')
    .eq('id', projectId)
    .single();
  const currentCost = parseFloat(proj?.cost_usd || '0');
  await supabase
    .from('project')
    .update({
      cost_usd: (currentCost + API_COSTS.nanoBananaProEdit).toFixed(4),
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  jobLog.info({ assetId }, 'Keyframe edit applied successfully');
}

async function fetchAssetWithScene(assetId: string) {
  const { data } = await supabase
    .from('asset')
    .select('id, type, url, scene_id, scene:scene(segment_index)')
    .eq('id', assetId)
    .single();
  if (!data) return null;
  const raw = data as any;
  const scene = Array.isArray(raw.scene) ? raw.scene[0] : raw.scene;
  return { id: raw.id, type: raw.type, url: raw.url, scene_id: raw.scene_id, scene } as {
    id: string;
    type: string;
    url: string | null;
    scene_id: string | null;
    scene: { segment_index: number } | null;
  };
}

worker.on('completed', (job) => {
  log.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, error) => {
  log.error({ jobId: job?.id, err: error }, 'Job failed');
});

worker.on('ready', () => {
  log.info('Pipeline worker connected and ready for jobs');
});

worker.on('error', (error) => {
  log.error({ err: error }, 'Worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('Shutting down...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('Shutting down...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
});
