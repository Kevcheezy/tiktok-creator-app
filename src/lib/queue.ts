import { Queue } from 'bullmq';

export type PipelineJobData = {
  projectId: string;
  step: 'product_analysis' | 'scripting' | 'casting' | 'directing' | 'voiceover' | 'editing';
};

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null as null,
  };
}

let _pipelineQueue: Queue<PipelineJobData> | null = null;

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_CONNECTION_URL || 'redis://localhost:6379';
  return parseRedisUrl(redisUrl);
}

export function getPipelineQueue(): Queue<PipelineJobData> {
  if (!_pipelineQueue) {
    _pipelineQueue = new Queue<PipelineJobData>('pipeline', {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _pipelineQueue;
}
