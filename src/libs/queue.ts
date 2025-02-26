import {
  // CronJobType,
  JobData,
  // JobEntry,
  JobHandler,
  JobOptions,
  PushJob,
  RedisConnection,
  WorkerOptions,
} from '../types/index.ts';
import { genJobId, isRedisConnection } from '../utils/index.ts';
import { Worker } from './worker.ts';

export class Queue {
  readonly db: RedisConnection;
  readonly key: string;
  readonly streamdb: RedisConnection;
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

    const id: string = state?.options?._id
      ? state?.options?._id
      : genJobId(`${state.name}`, state?.data ?? {});

      const job: Partial<JobData> = {
      id: id,
      priority: priority,
      state: { ...state, path: `${this.key}/${state.name}` },
      status: state?.options?.repeat?.pattern ? 'delayed' : 'waiting',
      delayUntil: delayUntil.getTime(),
      lockUntil: Date.now(),
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

  async pause(): Promise<void> {
      const pausedKey = `queues:${this.key}:paused`;
      await this.db.set(pausedKey, 'true');
    }

  async resume(): Promise<void> {
      const pausedKey = `queues:${this.key}:paused`;
      await this.db.del(pausedKey);
   }

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
        // XTRIM key MAXLEN [~] count
        // The '~' flag with MAXLEN trims to approximately maxLen entries
        // Redis keeps the most recent entries by default
        await this.streamdb.xtrim(this.key + '-stream', 'MAXLEN', maxLen);
    } catch (error) {
        console.error(`Error trimming stream ${this.key}:`, error);
        throw error;
    }
  }

  async add(data: Record<string, string>): Promise<string> {
    const id = await this.streamdb.xadd(this.key + '-stream', '*', data) as string;
    await this.xtrim(); // Automatically trim to keep most recent 200 entries
    return id;
  }
      // async getAllJobs(): Promise<Array<JobData>> {
    //   const results: Array<JobData> = [];
    //   let index = 0;
    //   const jobKeyPattern = `${this.key}:jobs:*`;
    //   // console.log(jobKeyPattern);
    //   let cursor = '0';

    //   do {
    //     const [nextCursor, keys] = await this.db.scan(
    //       cursor,
    //       'MATCH',
    //       jobKeyPattern,
    //       'COUNT',
    //       200,
    //     );

    //     cursor = nextCursor;

    //     for (const key of keys) {
    //       const value = await this.db.get(key);

    //       if (!value) continue;

    //       const jobData = JSON.parse(value) as JobData;
    //       const [_prefix, _jobsKey, priority, id] = key.split(':');

    //       if (typeof priority !== 'string' || !id) continue;

    //       let place: number;
    //       let status: JobEntry['status'];

    //       if (new Date(jobData.lockUntil) > new Date()) {
    //         place = 0;
    //         status = 'processing';
    //       } else if (new Date(jobData.delayUntil) > new Date()) {
    //         index++;
    //         place = index;
    //         status = 'delayed';
    //       } else {
    //         index++;
    //         place = index;
    //         status = 'waiting';
    //       }

    //       results.push({
    //         ...jobData,
    //         id: [priority, id],
    //         place,
    //         status,
    //       });
    //     }
    //   } while (cursor !== '0');

    //   return results;
    // }

  //   async removeDuplicate(jobName: string, jobValue: CronJobType): Promise<void> {
  //     const jobObject = {
  //       state: {
  //         name: jobName,
  //         data: {},
  //         options: jobValue?.options || {},
  //       },
  //     };
  //     const jobKey = `${this.key}:${JOBS_KEY}:0:${
  //       genJobId(jobName, jobObject.state.data)
  //     }`;
  //     let foundJob = await this.db.get(jobKey);

  //     if (!foundJob) {
  //       return;
  //     }

  //     foundJob = JSON.parse(foundJob);

  //     if (foundJob) {
  //       if (!jobObject.state.options?.repeat?.pattern) {
  //         await this.db.del(jobKey);
  //       }
  //     }
  //     return;
  //   }

  //   async deleteWaitingJobs(): Promise<void> {
  //     for (const job of await this.getAllJobs()) {
  //       // console.log(key)
  //       // const value = await this.db.get(key);

  //       if (new Date(job.lockUntil) > new Date()) {
  //         continue;
  //       }
  //       const jobKey = `${this.key}:${JOBS_KEY}:${job.id.join(':')}`;
  //       await this.db.del(jobKey);
  //     }
  //   }

  //   async deleteJob(id: JobData['id']): Promise<void> {
  //     const jobKey = `${this.key}:${JOBS_KEY}:${id.join(':')}`;
  //     await this.db.del(jobKey);
  //   }

  //   async listenUpdates(
  //     onUpdate: (jobs: Array<JobEntry>) => void,
  //     options: { signal?: AbortSignal; pollIntervalMs?: number },
  //   ): Promise<void> {
  //     const { signal, pollIntervalMs = 3000 } = options;
  //     let lastJobsIds = '';
  //     while (true) {
  //       if (signal?.aborted) break;

  //       const jobs = await this.getAllJobs();
  //       const jobsIds = jobs.map((job) => job.id.join(':')).join();
  //       if (jobsIds !== lastJobsIds) {
  //         onUpdate(jobs);
  //         lastJobsIds = jobsIds;
  //       }

  //       await delay(pollIntervalMs);
  //     }
  //   }

  //   // Streams utility functions
  //   async readStream(
  //     count: number = 200,
  //     block: number = 5000,
  //     start: string = '>',
  //   ): Promise<Array<string>> {
  //     const jobs = await this.db.xreadgroup(
  //       'GROUP',
  //       CONSUMER_GROUP,
  //       STREAM_NAME,
  //       'COUNT',
  //       count,
  //       'BLOCK',
  //       block,
  //       'STREAMS',
  //       STREAM_NAME,
  //       start,
  //     );
  //     return jobs;
  //   }

  //   sanitizeStream(stream: string[]): Promise<JobEntry[]> {
  //     if (!stream?.[0]?.[1]) return [];

  //     const messages = stream[0][1]; // Get the array of messages
  //     return messages.map(([messageId, [_, jobDataStr]]) => {
  //       const jobData = JSON.parse(jobDataStr);
  //       return {
  //         messageId,
  //         ...jobData,
  //       };
  //     });
  //   }

}
