import pino from 'pino';
import { APP_VERSION, GIT_COMMIT, ENVIRONMENT } from '@/lib/version';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoggerContext {
  projectId?: string;
  agentName?: string;
  jobId?: string;
  correlationId?: string;
}

export interface GenerationLogEvent {
  project_id: string;
  correlation_id?: string;
  event_type: string;
  agent_name?: string;
  stage?: string;
  detail?: Record<string, unknown>;
  app_version?: string;
}

// ─── Base Logger ──────────────────────────────────────────────────────────────

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    version: APP_VERSION,
    commit: GIT_COMMIT,
    environment: ENVIRONMENT,
  },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a child logger with contextual metadata.
 * All log entries from the returned logger include the given context fields.
 */
export function createLogger(context: LoggerContext = {}): pino.Logger {
  const bindings: Record<string, unknown> = {};
  if (context.projectId) bindings.projectId = context.projectId;
  if (context.agentName) bindings.agentName = context.agentName;
  if (context.jobId) bindings.jobId = context.jobId;
  if (context.correlationId) bindings.correlationId = context.correlationId;
  return baseLogger.child(bindings);
}

// ─── Default root logger for API routes ───────────────────────────────────────

export const logger = baseLogger;

// ─── generation_log helper ────────────────────────────────────────────────────

/**
 * Persist an event to the generation_log table.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function logToGenerationLog(
  supabase: SupabaseClient,
  event: GenerationLogEvent
): Promise<void> {
  try {
    const { error } = await supabase.from('generation_log').insert({
      project_id: event.project_id,
      correlation_id: event.correlation_id || null,
      event_type: event.event_type,
      agent_name: event.agent_name || null,
      stage: event.stage || null,
      detail: event.detail || null,
      app_version: event.app_version || APP_VERSION,
    });
    if (error) {
      baseLogger.warn({ err: error, event_type: event.event_type }, 'Failed to write to generation_log');
    }
  } catch (err) {
    baseLogger.warn({ err, event_type: event.event_type }, 'Failed to write to generation_log');
  }
}
