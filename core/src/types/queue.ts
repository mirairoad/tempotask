import type { JobState } from './job.ts';

/**
 * Represents the options for the queue
 */
export interface QueueOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Represents the next job entry
 */
export interface NextJobEntry {
  id: string;
  messageId: string;
  streamKey: string;
  state: JobState;
  status: string;
  priority: number;
  addedAt: number;
  delayUntil: number;
  lockUntil: number;
  lastRun?: number;
  retriedAttempts: number;
  repeatCount: number;
  repeatDelayMs: number;
  retryCount: number;
  retryDelayMs: number;
} 