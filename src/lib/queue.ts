import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_CONNECTION_URL || 'redis://localhost:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export type PipelineJobData = {
  projectId: string;
  step: 'product_analysis' | 'scripting' | 'casting' | 'directing' | 'editing';
};

export const pipelineQueue = new Queue<PipelineJobData>('pipeline', {
  connection: {
    host: connection.options.host,
    port: connection.options.port,
    password: connection.options.password,
    username: connection.options.username,
    db: connection.options.db,
    maxRetriesPerRequest: null,
  },
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
