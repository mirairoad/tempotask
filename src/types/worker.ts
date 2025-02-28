import { JobData } from './index.ts';

export interface WorkerOptions {
  concurrency?: number;
  lockDurationMs?: number;
  lockIntervalMs?: number;
  pollIntervalMs?: number;
}

export interface WorkerEventMap {
  error: CustomEvent<{
    error: Error;
    job: JobData;
  }>;
}

export type WorkerEvent = keyof WorkerEventMap; 