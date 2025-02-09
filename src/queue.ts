import {
  // CronJobType,
  JobData,
  // JobEntry,
  JobHandler,
  JobOptions,
  PushJob,
  RedisConnection,
  WorkerOptions,
} from './types.ts';
import { genJobId, isRedisConnection } from './utils.ts';
import { Worker } from './worker.ts';

export class Queue {
  readonly db: RedisConnection;
  readonly key: string;

  constructor(db: unknown, key: string) {
    if (!isRedisConnection(db)) {
      throw new Error(
        'Database connection must implement RedisConnection interface',
      );
    }
    this.db = db;
    this.key = key;
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      // Create the stream and consumer group if they don't exist
      await this.db.xgroup('CREATE', 
        `${this.key}-stream`, 
        'workers', 
        '0', 
        'MKSTREAM'
      );
    } catch (err: any) {
      // Ignore error if group already exists
      if (!err.message.includes('BUSYGROUP')) {
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

    const extendedOptions = {
      priority: -0,
      delayUntil: new Date(),
      repeatCount: 0,
      repeatDelayMs: 0,
      retryCount: 0,
      retryDelayMs: 0,
      ...options,
    };

    const {
      priority,
      delayUntil,
      repeatCount,
      repeatDelayMs,
      retryCount,
      retryDelayMs,
    } = extendedOptions;

    const id: string = state?.options?._id
      ? state?.options?._id
      : genJobId(`${state.name}`, state?.data ?? {});

    const job: Partial<JobData> = {
      id: id,
      priority: priority,
      state: { ...state, path: `${this.key}/${state.name}` },
      status: 'waiting',
      delayUntil,
      lockUntil: new Date(),
      repeatCount,
      repeatDelayMs,
      retryCount,
      retryDelayMs,
    };

    const timestamp = new Date().getTime();
    const stringifiedJob = JSON.stringify({ ...job, timestamp });
    await this.db.xadd(`${this.key}-stream`, '*', 'data', stringifiedJob);
    await this.db.set(`${id}:${timestamp}`, stringifiedJob);
    // console.log(stringifiedJob);
    return { id, ...job };
  }

  //   async pause(): Promise<void> {
  //     const pausedKey = `${this.key}:paused`;
  //     await this.db.set(pausedKey, 'true');
  //   }

  //   async resume(): Promise<void> {
  //     const pausedKey = `${this.key}:paused`;
  //     await this.db.del(pausedKey);
  //   }

  //   async getAllJobs(): Promise<Array<JobEntry>> {
  //     const results: Array<JobEntry> = [];
  //     let index = 0;
  //     const jobKeyPattern = `${this.key}:${JOBS_KEY}:*`;
  //     // console.log(jobKeyPattern);
  //     let cursor = '0';

  //     do {
  //       const [nextCursor, keys] = await this.db.scan(
  //         cursor,
  //         'MATCH',
  //         jobKeyPattern,
  //         'COUNT',
  //         200,
  //       );

  //       cursor = nextCursor;

  //       for (const key of keys) {
  //         const value = await this.db.get(key);

  //         if (!value) continue;

  //         const jobData = JSON.parse(value) as JobData;
  //         const [_prefix, _jobsKey, priority, id] = key.split(':');

  //         if (typeof priority !== 'string' || !id) continue;

  //         let place: number;
  //         let status: JobEntry['status'];

  //         if (new Date(jobData.lockUntil) > new Date()) {
  //           place = 0;
  //           status = 'processing';
  //         } else if (new Date(jobData.delayUntil) > new Date()) {
  //           index++;
  //           place = index;
  //           status = 'delayed';
  //         } else {
  //           index++;
  //           place = index;
  //           status = 'waiting';
  //         }

  //         results.push({
  //           ...jobData,
  //           id: [priority, id],
  //           place,
  //           status,
  //         });
  //       }
  //     } while (cursor !== '0');

  //     return results;
  //   }

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

  createWorker(
    handler: JobHandler,
    options?: WorkerOptions,
  ): Worker {
    return new Worker(this.db, this.key, handler, options);
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
        await this.db.xtrim(this.key + '-stream', 'MAXLEN', maxLen);
    } catch (error) {
        console.error(`Error trimming stream ${this.key}:`, error);
        throw error;
    }
  }

  async add(data: Record<string, string>): Promise<string> {
    const id = await this.db.xadd(this.key + '-stream', '*', data) as string;
    await this.xtrim(); // Automatically trim to keep most recent 200 entries
    return id;
  }
}
