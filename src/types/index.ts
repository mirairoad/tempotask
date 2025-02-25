import { JobHandler, JobOptions } from './job.ts';

export * from './job.ts';
export * from './worker.ts';
export * from './queue.ts';
export * from './redis.ts';

// Any shared types or interfaces can be defined here
export interface JobQueueManagerOptions {
  concurrency?: number;
}

export type JobType = {
  path: string;
  handler: JobHandler;
  options?: JobOptions;
};
