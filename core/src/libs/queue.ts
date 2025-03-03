import {
  // CronJobType,
  JobData,
  // JobEntry,
  JobHandler,
  JobOptions,
  JobState,
  PushJob,
  RedisConnection,
  WorkerOptions,
} from '../types/index.ts';
import { genJobId, isRedisConnection } from '../utils/index.ts';
import { Worker } from './worker.ts';

/**
 * Queue implementation for Redis-MQ
 * Handles job queueing, stream operations and worker creation
 */
export class Queue {
  readonly db: RedisConnection;
  readonly key: string;
  readonly streamdb: RedisConnection;

  /**
   * Creates a new Queue instance
   * @param db - Redis connection for job storage
   * @param key - Queue name/identifier
   * @param streamdb - Optional separate Redis connection for streams
   */
  constructor(db: RedisConnection, key: string, streamdb?: RedisConnection) {
    if (!isRedisConnection(db)) {
      throw new Error(
        'Database connection must implement RedisConnection interface',
      );
    }
    this.db = db;
    this.key = key;
    this.streamdb = streamdb || db;
  }

  /**
   * Ensures the consumer group exists for this queue
   * Creates it if it doesn't exist
   */
  private async ensureConsumerGroup(): Promise<void> {
    try {
      // Create the stream and consumer group if they don't exist
      await this.streamdb.xgroup('CREATE', 
        `${this.key}-stream`, 
        'workers', 
        '0', 
        'MKSTREAM'
      );
    } catch (err: unknown) {
      // Ignore error if group already exists
      if (err instanceof Error && !err.message.includes('BUSYGROUP')) {
        console.error('Error creating consumer group:', err);
        throw err;
      }
    }
  }

  /**
   * Pushes a new job to the queue
   * @param state - Job state including name and data
   * @param options - Job options like priority and delay
   * @returns Job data
   */
  async pushJob(
    state: PushJob,
    options: JobOptions = {},
  ): Promise<unknown> {
    // Ensure consumer group exists before pushing jobs
    await this.ensureConsumerGroup();

    const defaultOptions = {
      priority: -0,
      delayUntil: new Date(),
      repeatCount: 0,
      repeatDelayMs: 0,
      retryCount: 0,
      retryDelayMs: 0,
      retriedAttempts: 0,
      logs: [],
      errors: [],
      ...options,
    };

    const {
      priority,
      delayUntil,
      repeatCount,
      repeatDelayMs,
      retryCount,
      retryDelayMs,
      retriedAttempts,
      logs,
      errors,
    } = defaultOptions;

    const id: string = state?.options?.id
      ? state?.options?.id
      : genJobId(`${state.name}`, state?.data ?? {});

      const job: Partial<JobData> = {
      id: id,
      priority: priority,
      state: { ...state, path: `${this.key}/${state.name}` },
      status: state?.options?.repeat?.pattern ? 'delayed' : 'waiting',
      delayUntil: delayUntil.getTime(),
      lockUntil: Date.now(),
      paused: false,
      retriedAttempts,
      repeatCount,
      repeatDelayMs,
      retryCount,
      retryDelayMs,
      logs: [{
        message: `Added to the queue`,
        timestamp: Date.now()
      }],
      errors,
    };

    const timestamp = new Date().getTime();
    const data = { 
      ...job,
      addedAt: timestamp,
      timestamp // Set initial timestamp
    };
    const stringifiedJob = JSON.stringify(data);
    
    await this.streamdb.xadd(`${this.key}-stream`, '*', 'data', stringifiedJob);
    await this.db.set(`queues:${this.key}:${id}:${data.status}`, stringifiedJob);
    return { id, ...job };
  }

  /**
   * Pauses job processing for this queue
   */
  async pause(): Promise<void> {
      const pausedKey = `queues:${this.key}:paused`;
      await this.db.set(pausedKey, 'true');
    }

  /**
   * Resumes job processing for this queue
   */
  async resume(): Promise<void> {
      const pausedKey = `queues:${this.key}:paused`;
      await this.db.del(pausedKey);
   }

  /**
   * Gets all jobs from the queue
   * @param count - Maximum number of jobs to retrieve (default: 200)
   * @param block - How long to block waiting for jobs in ms (default: 5000)
   * @returns Array of job data
   */
  async getAllJobs(
      count: number = 200,
      block: number = 5000,
    ): Promise<Array<JobData>> {
      // Ensure consumer group exists before reading
      await this.ensureConsumerGroup();
      
      const consumerId = `worker-${Math.random().toString(36).substring(2, 15)}`;
      
      try {
        const jobs = await this.streamdb.xreadgroup(
          'GROUP', 
          'workers', 
          consumerId,
          'COUNT',
          count,
          'BLOCK',
          block,
          'STREAMS',
          `${this.key}-stream`,
          '>'
        ) as [string, [string, string]][];
  
        if (!jobs?.[0]?.[1]?.length) {
          return [];
        }
  
        return this.sanitizeStream(jobs);
      } catch (error) {
        console.error('Error reading from stream:', error);
        return [];
      }
  }
  
  /**
   * Processes and sanitizes raw stream data into job objects
   * @param stream - Raw stream data from Redis
   * @returns Array of sanitized job objects
   */
  sanitizeStream(stream: [string, [string, string]][]): JobData[] {
      if (!stream?.[0]?.[1]) return [];
      
      const messages = stream[0][1];
      const processedIds = new Set(); // Track processed job IDs
      
      return messages
        .map(([messageId, [_, jobDataStr]]) => {
          try {
            // Ensure jobDataStr is a valid JSON string
            if (!jobDataStr || typeof jobDataStr !== 'string') {
              console.error('Invalid job data:', jobDataStr);
              return null;
            }
  
            const jobData = JSON.parse(jobDataStr);
            
            if (!jobData) {
              console.error('Failed to parse job data:', jobDataStr);
              return null;
            }
  
            return {
              messageId,
              streamKey: stream[0][0],
              ...jobData
            };
          } catch (error) {
            console.error('Error parsing job data:', error);
            console.error('Raw job data:', jobDataStr);
            return null;
          }
        })
        .filter((job): job is JobData => {
          if (!job) return false;
          
          // Only process unique jobs based on ID and path
          const jobIdentifier = `${job.id}:${job.state?.path}`;
          if (processedIds.has(jobIdentifier)) {
            return false;
          }
          processedIds.add(jobIdentifier);
          return true;
        });
  }

  /**
   * Creates a worker for this queue
   * @param handler - Function to process jobs
   * @param options - Worker options
   * @returns Worker instance
   */
  createWorker(
    handler: (jobData: JobData) => Promise<void> ,
    options?: WorkerOptions,
  ): Worker {
    return new Worker(this.db, this.key, handler as unknown as JobHandler, options, this.streamdb);
  }

  /**
   * Trims the stream to keep only the most recent entries
   * @param maxLen Maximum number of most recent entries to keep (default: 200)
   */
  async xtrim(maxLen: number = 200): Promise<void> {
    try {
        await this.streamdb.xtrim(this.key + '-stream', 'MAXLEN', maxLen);
    } catch (error) {
        // console.error(`Error trimming stream ${this.key}:`, error);
        throw error;
    }
  }

  /**
   * Adds data directly to the stream
   * @param data - Key-value data to add to the stream
   * @returns Generated message ID
   */
  async add(data: Record<string, string>): Promise<string> {
    const id = await this.streamdb.xadd(this.key + '-stream', '*', data) as string;
    await this.xtrim(); // Automatically trim to keep most recent 200 entries
    return id;
  }
}
