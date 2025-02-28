export interface JobState {
  name: string;
  data?: unknown;
  options?: JobOptions;
  path: string;
}

export interface JobData {
  id: string;
  messageId: string;
  streamKey?: string;
  state: JobState;
  status: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
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
  paused: boolean;
  logs?: {
    message: string;
    timestamp: number;
  }[];
  errors?: string[];
  timestamp: number;
}

export interface JobOptions {
  id?: string;
  priority?: number;
  delayUntil?: Date;
  lockUntil?: Date;
  retryCount?: number;
  retryDelayMs?: number;
  repeatCount?: number;
  repeatDelayMs?: number;
  retriedAttempts?: number;
  repeat?: {
    pattern: string;
  };
  attempts?: number;
  logs?: string[];
  errors?: string[];
}

export interface PushJob {
  name: string;
  data?: unknown;
  options?: JobOptions;
}

export interface ExtJobData extends JobState {
  logger: (message: string | object) => Promise<void> 
}

export interface JobHandler{
  (job: ExtJobData,
  ctx: unknown): Promise<void>
}
 
  // update: (job: Partial<JobData>) => Promise<void>,
  // helpers: { stopProcessing: () => void }; 