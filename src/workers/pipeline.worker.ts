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
import { WaveSpeedClient } from '../lib/api-clients/wavespeed';
import { ElevenLabsClient } from '../lib/api-clients/elevenlabs';
import { FALLBACK_VOICES, API_COSTS } from '../lib/constants';
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

log.info({ version: APP_VERSION, commit: GIT_COMMIT }, 'Pipeline worker starting');

const worker = new Worker(
  'pipeline',
  async (job: Job) => {
    const { projectId, step } = job.data;
    const correlationId = crypto.randomUUID();
    const jobLog = createLogger({ agentName: 'PipelineWorker', jobId: job.id, correlationId, projectId });

    jobLog.info({ step }, 'Processing job');

    if (step === 'product_analysis') {
      await handleProductAnalysis(projectId, correlationId, jobLog);
    } else if (step === 'scripting') {
      await handleScripting(projectId, correlationId, jobLog);
    } else if (step === 'casting') {
      await handleCasting(projectId, correlationId, jobLog);
    } else if (step === 'directing') {
      await handleDirecting(projectId, correlationId, jobLog);
    } else if (step === 'voiceover') {
      await handleVoiceover(projectId, correlationId, jobLog);
    } else if (step === 'editing') {
      await handleEditing(projectId, correlationId, jobLog);
    } else if (step === 'regenerate_asset') {
      await handleAssetRegeneration(projectId, job.data.assetId, correlationId, jobLog);
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

async function handleProductAnalysis(projectId: string, correlationId: string, jobLog: ReturnType<typeof createLogger>) {
  const stage = 'analyzing';
  const stageStart = Date.now();
  try {
    await supabase
      .from('project')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_start', agent_name: 'ProductAnalyzerAgent', stage,
    });

    const agent = new ProductAnalyzerAgent(supabase);
    agent.setCorrelationId(correlationId);
    const analysis = await agent.run(projectId);

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
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'ProductAnalyzerAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Product analysis complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - stageStart;
    jobLog.error({ err: error, durationMs }, 'Product analysis failed');

    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
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

    throw error;
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
    await agent.run(projectId);

    await supabase
      .from('project')
      .update({ status: 'asset_review', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const durationMs = Date.now() - stageStart;
    await logToGenerationLog(supabase, {
      project_id: projectId, correlation_id: correlationId,
      event_type: 'stage_complete', agent_name: 'VoiceoverAgent', stage,
      detail: { durationMs },
    });
    jobLog.info({ durationMs }, 'Voiceover complete');
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

    await supabase
      .from('asset')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
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
  jobLog: ReturnType<typeof createLogger>
) {
  const scene = asset.scene;
  const visualPrompt = scene?.visual_prompt as { start: string; end: string } | null;
  const promptText = asset.type === 'keyframe_start'
    ? visualPrompt?.start
    : visualPrompt?.end;

  if (!promptText) throw new Error('No visual prompt found on scene for regeneration');

  // Check if project uses influencer (image-to-image) or text-to-image
  const { data: project } = await supabase
    .from('project')
    .select('*, influencer:influencer(*)')
    .eq('id', projectId)
    .single();

  const wavespeed = new WaveSpeedClient();
  let taskId: string;
  let cost: number;

  if (project?.influencer?.image_url) {
    jobLog.info('Regenerating keyframe via image edit (influencer)');
    const result = await wavespeed.editImage(
      [project.influencer.image_url],
      promptText,
      { aspectRatio: '9:16' }
    );
    taskId = result.taskId;
    cost = API_COSTS.nanoBananaProEdit;
  } else {
    jobLog.info('Regenerating keyframe via text-to-image');
    const result = await wavespeed.generateImage(promptText);
    taskId = result.taskId;
    cost = API_COSTS.nanoBananaPro;
  }

  jobLog.info({ taskId }, 'Polling keyframe result');
  const pollResult = await wavespeed.pollResult(taskId, { maxWait: 120000, initialInterval: 5000 });

  await supabase
    .from('asset')
    .update({
      url: pollResult.url || '',
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

  const shotScripts = scene.shot_scripts as { index: number; text: string; energy: string }[] | null;
  const multiPrompt = (shotScripts || []).map((shot: any) => ({
    prompt: `${shot.text}. Energy: ${shot.energy}. Camera follows subject naturally.`,
    duration: '5',
  }));

  const mainPrompt = [
    scene.script_text ? `Scene: ${scene.script_text.substring(0, 200)}` : '',
    scene.section ? `Section: ${scene.section}` : '',
    'Natural movement, professional lighting, TikTok style video, 9:16 portrait',
  ].filter(Boolean).join('. ');

  const wavespeed = new WaveSpeedClient();
  const result = await wavespeed.generateVideo({
    image: startKf.url,
    tailImage: endKf?.url,
    prompt: mainPrompt,
    negativePrompt: 'watermark, text overlay, blurry, distorted, flickering, low quality, static, frozen',
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
