import { RedisConnection, PushJob, JobOptions, JobData, JobEntry, JobHandler, WorkerOptions, CronJobType } from './types.ts';
import { isRedisConnection, genJobId, delay } from './utils.ts';
import { Worker } from './worker.ts';
import config from './config.ts';

const JOBS_KEY = 'jobs' as const;
const { STREAM_NAME, CONSUMER_GROUP } = config;

export class Queue {
    readonly db: RedisConnection;
    readonly key: string;
  
    constructor(db: unknown, key: string) {
      if (!isRedisConnection(db)) {
        throw new Error('Database connection must implement RedisConnection interface');
      }
      this.db = db;
      this.key = key;
    }
  
    async pushJob(
      state: PushJob,
      options: JobOptions = {},
    ): Promise<unknown> {
  
      const extendedOptions = {
        priority : -0,
        delayUntil : new Date(),
        repeatCount : 0,
        repeatDelayMs : 0,
        retryCount : 0,
        retryDelayMs : 0,
        ...options,
      }
  
      const {
        priority,
        delayUntil,
        repeatCount,
        repeatDelayMs,
        retryCount,
        retryDelayMs,
      } = extendedOptions;
  
      const id: string[] = [
        `${-priority}`,
        state?.options?._id
          ? state?.options?._id
          : genJobId(`${state.name}`, state?.data ?? {}),
      ];

      const jobKey = `${this.key}:${JOBS_KEY}:${id.join(':')}`;
// console.log(jobKey)
      const job: Partial<JobData> = {
        state: { ...state, path: `${this.key}/${state.name}` },
        delayUntil,
        lockUntil: new Date(),
        repeatCount,
        repeatDelayMs,
        retryCount,
        retryDelayMs,
      };
      
      // console.log(jobKey);
    //   await this.db.set(jobKey, JSON.stringify(job));
    await this.db.xadd(STREAM_NAME, "*", "data", JSON.stringify(job));
    // console.log(await this.db.xinfo('GROUPS', 'jobs'))
    const jobs = await this.readStream(1000, 5000, ">")  
      await this.sanitizeStream(jobs)
      return { id, ...job };
    }
  
    async pause(): Promise<void> {
      const pausedKey = `${this.key}:paused`;
      await this.db.set(pausedKey, 'true');
    }
  
    async resume(): Promise<void> {
      const pausedKey = `${this.key}:paused`;
      await this.db.del(pausedKey);
    }
  
    async getAllJobs(): Promise<Array<JobEntry>> {
      const results: Array<JobEntry> = [];
      let index = 0;
      const jobKeyPattern = `${this.key}:${JOBS_KEY}:*`;
      // console.log(jobKeyPattern);
      let cursor = '0';
  
      do {
        const [nextCursor, keys] = await this.db.scan(
          cursor,
          'MATCH',
          jobKeyPattern,
          'COUNT',
          200,
        );
  
        cursor = nextCursor;
  
        for (const key of keys) {
          const value = await this.db.get(key);
  
          if (!value) continue;
  
          const jobData = JSON.parse(value) as JobData;
          const [_prefix, _jobsKey, priority, id] = key.split(':');
  
          if (typeof priority !== 'string' || !id) continue;
  
          let place: number;
          let status: JobEntry['status'];
  
          if (new Date(jobData.lockUntil) > new Date()) {
            place = 0;
            status = 'processing';
          } else if (new Date(jobData.delayUntil) > new Date()) {
            index++;
            place = index;
            status = 'delayed';
          } else {
            index++;
            place = index;
            status = 'waiting';
          }
  
          results.push({
            ...jobData,
            id: [priority, id],
            place,
            status,
          });
        }
      } while (cursor !== '0');
  
      return results;
    }
  
    async removeDuplicate(jobName: string, jobValue: CronJobType): Promise<void> {
      const jobObject = {
        state: {
          name: jobName,
          data: {},
          options: jobValue?.options || {},
        },
      };
      const jobKey = `${this.key}:${JOBS_KEY}:0:${
        genJobId(jobName, jobObject.state.data)
      }`;
      let foundJob = await this.db.get(jobKey);
  
      if (!foundJob) {
        return;
      }
  
      foundJob = JSON.parse(foundJob);
  
      if (foundJob) {
        if (!jobObject.state.options?.repeat?.pattern) {
          await this.db.del(jobKey);
        }
      }
      return;
    }
  
    async deleteWaitingJobs(): Promise<void> {
      for (const job of await this.getAllJobs()) {
        // console.log(key)
        // const value = await this.db.get(key);
  
        if (new Date(job.lockUntil) > new Date()) {
          continue;
        }
        const jobKey = `${this.key}:${JOBS_KEY}:${job.id.join(':')}`;
        await this.db.del(jobKey);
      }
    }
  
    async deleteJob(id: JobData['id']): Promise<void> {
      const jobKey = `${this.key}:${JOBS_KEY}:${id.join(':')}`;
      await this.db.del(jobKey);
    }
  
    async listenUpdates(
      onUpdate: (jobs: Array<JobEntry>) => void,
      options: { signal?: AbortSignal; pollIntervalMs?: number },
    ): Promise<void> {
      const { signal, pollIntervalMs = 3000 } = options;
      let lastJobsIds = '';
      while (true) {
        if (signal?.aborted) break;
  
        const jobs = await this.getAllJobs();
        const jobsIds = jobs.map((job) => job.id.join(':')).join();
        if (jobsIds !== lastJobsIds) {
          onUpdate(jobs);
          lastJobsIds = jobsIds;
        }
  
        await delay(pollIntervalMs);
      }
    }

    // Streams utility functions
    async readStream(count: number = 200, block: number = 5000, start: string = '>'): Promise<Array<string>> {
      const jobs = await this.db.xreadgroup(
        "GROUP", CONSUMER_GROUP, STREAM_NAME,
        "COUNT", count,
        "BLOCK", block,
        "STREAMS", STREAM_NAME, start
      );
      return jobs;
    }

    async sanitizeStream(stream: string[]): Promise<void> {
        // console.log(stream)
    }
  
    createWorker(
      handler: JobHandler,
      options?: WorkerOptions,
    ): Worker {
      return new Worker(this.db, this.key, handler, options);
    }
  }