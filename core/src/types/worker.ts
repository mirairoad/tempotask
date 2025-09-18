import type { JobData } from './job.ts';

/**
 * Represents the options for the worker
 */
export interface WorkerOptions {
  concurrency?: number;
  lockDurationMs?: number;
  lockIntervalMs?: number;
  pollIntervalMs?: number;
}

/**
 * Represents the event map for the worker
 */
export interface WorkerEventMap {
  error: CustomEvent<{
    error: Error;
    job: JobData;
  }>;
}

/**
 * Represents the event type for the worker
 */
export type WorkerEvent = keyof WorkerEventMap;
