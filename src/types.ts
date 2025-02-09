export interface RedisConnection {
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  scan(
    cursor: string | number,
    ...args: unknown[]
  ): Promise<[string, string[]]>;
  watch(key: string): Promise<unknown>;
  unwatch(): Promise<unknown>;
  multi(): RedisMulti;
  hset(key: string, field: string, value: string): Promise<unknown>;
  hget(key: string, field: string): Promise<string | null>;
  xgroup(
    command: string,
    stream: string,
    group: string,
    start: string,
    end: string,
  ): Promise<unknown>;
  xreadgroup(
    command: string,
    group: string,
    consumer: string,
    stream: string,
    ...args: unknown[]
  ): Promise<unknown>;
  xadd(stream: string, id: string, ...args: unknown[]): Promise<unknown>;
  xdel(stream: string, ...ids: string[]): Promise<unknown>;
  xlen(stream: string): Promise<number>;
  xack(group: string, ...ids: string[]): Promise<unknown>;
  xtrim(stream: string, strategy: string, maxLen: number): Promise<unknown>;
}

export interface RedisMulti {
  set(key: string, value: string): this;
  exec(): Promise<unknown[] | null>;
}

// Base interfaces
interface BaseState {
  data?: unknown;
  options?: JobStateOptions;
}

interface BaseJobOptions {
  repeat?: {
    pattern: string;
  };
  attempts?: number;
  _id?: string;
}

// Core types
export interface JobState extends BaseState {
  path: string;
  name: string;
}

export interface PushJob extends BaseState {
  name: string;
}

export type JobStateOptions = BaseJobOptions;

export interface JobOptions extends BaseJobOptions {
  priority?: number;
  delayUntil?: Date;
  repeatCount?: number;
  repeatDelayMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

// Job data and entries
export interface JobData {
  messageId: string;
  id: string;
  name: string;
  priority: number;
  state: JobState;
  delayUntil: Date;
  lockUntil: Date;
  repeatCount: number;
  repeatDelayMs: number;
  retryCount: number;
  retryDelayMs: number;
  status?: JobStatus;
}

export interface JobEntry extends JobData {
  place: number;
  status: JobStatus;
}

export interface NextJobEntry {
  key: string;
  value: JobData;
}

// Status and worker types
export type JobStatus =
  | 'waiting'
  | 'processing'
  | 'delayed'
  | 'completed'
  | 'stalled'
  | 'failed'
  | 'removed';

export interface WorkerOptions {
  concurrency?: number;
  lockDurationMs?: number;
  lockIntervalMs?: number;
  pollIntervalMs?: number;
}

// Handler types
export interface JobHandlerParams {
  stopProcessing: () => void;
}

export type JobHandler = (
  job: JobData,
  updateJob: (job: Partial<JobData>) => Promise<void>,
  params: JobHandlerParams,
) => Promise<void>;

// Event types
export interface WorkerEventMap {
  error: CustomEvent<{ error: Error; job: JobData }>;
  complete: CustomEvent<{ job: JobData }>;
}

export interface WorkerEvent extends Event {
  detail: {
    error: Error;
    job: JobData;
  };
}

export type JobsOptions = {
  repeat?: {
    pattern: string;
    tz?: string;
  };
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
};

export interface CronJobType {
  path: string;
  run: (ctx: any, job: unknown) => void | Promise<void>;
  options?: {
    repeat?: {
      pattern: string;
    };
    _id?: string;
  };
}
