export interface RedisConnection {
    set(key: string, value: string): Promise<unknown>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<unknown>;
    scan(cursor: string | number, ...args: unknown[]): Promise<[string, string[]]>;
    watch(key: string): Promise<unknown>;
    unwatch(): Promise<unknown>;
    multi(): RedisMulti;
    xgroup(command: string, stream: string, group: string, start: string, end: string): Promise<unknown>;
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
    id: string[];
    name: string;
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
  export type JobStatus = 'waiting' | 'processing' | 'delayed' | 'completed' | 'stalled' | 'failed' | 'removed';
  
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
    params: JobHandlerParams
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
      attempts?: number;
      backoff?: {
        type: 'fixed' | 'exponential';
        delay: number;
      };
      removeOnComplete?: boolean;
      removeOnFail?: boolean;
      repeat?: {
        pattern: string;
        tz?: string;
      };
    };
  
    
    
    export type CronJobType = {
      path: string;
      run: (ctx: unknown, job: unknown) => void;
      options?: JobsOptions;
    };