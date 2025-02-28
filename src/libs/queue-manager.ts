import {
  JobData,
  JobHandler,
  JobOptions,
  ExtJobData,
  JobQueueManagerOptions,
  JobState,
  JobType,
  RedisConnection
} from '../types/index.ts';
import { parseCronExpression } from 'cron-schedule';
import { Queue } from './queue.ts';
import { Worker } from './worker.ts';
export class QueueManager {
  private static instance: QueueManager;
  private queues: { [key: string]: { [key: string]: Queue } } = {};
  private workers: { [key: string]: Worker } = {};
  private handlers: {
    [key: string]: { [key: string]: JobHandler };
  } = {};
  private db: RedisConnection;
  private ctx: unknown;
  private concurrency: number;
  private streamdb: RedisConnection;
  private constructor(db: RedisConnection, ctx: any, concurrency: number, streamdb?: RedisConnection) {
    this.db = db;
    this.ctx = { ...ctx, addJob: this.addJob.bind(this) };
    this.concurrency = concurrency;
    this.streamdb = streamdb || db;
  }

  static init(
    db: RedisConnection,
    ctx: unknown = {},
    concurrency: number = 1,
    streamdb?: RedisConnection,
  ): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(db, ctx, concurrency, streamdb);
    }
    return QueueManager.instance;
  }

  async createConsumerGroup(queueName: string): Promise<void> {
    if (!queueName) {
      throw new Error('queueName is required');
    }
    try {
      await this.streamdb.xgroup(
        'CREATE',
        `${queueName}-stream`,
        '*', // keep an eye on this as the consumer is always worker
        '$',
        'MKSTREAM',
      );
    } catch (err) {
      const error = err as { message: string };
      if (!error?.message?.includes('BUSYGROUP')) console.error(err);
    }
  }

  registerJob(job: { path: string, handler: (job: ExtJobData, ctx: unknown) => void, options?: JobOptions }): void {
    if (!job.path) {
      throw new Error(`maximum '/'`);
    }
    if (!job.path.includes('/')) {
      throw new Error(`path must include '/'`);
    }
    if (job.path.split('/').length !== 2) {
      throw new Error(`path must include only one forward '/'`);
    }
    const queueName = job.path.split('/')[0];
    const jobName = job.path.split('/')[1];

    let queue: Queue;

    if (!this.queues[queueName]) {
      queue = new Queue(this.db, queueName, this.streamdb);
      this.queues[queueName] = { queue };
      this.createConsumerGroup(queueName);
    } else {
      queue = this.queues[queueName].queue;
    }

    for (const key in this.queues[queueName]) {
      if (job?.options?.repeat?.pattern) {
        this.addJob(job.path, {}, job.options);
      } else {
        // comeback here later #edit
        // this.queues[queueName][key].removeDuplicate(jobName, job);
      }
    }

    this.handlers[queueName] = {
      ...this.handlers[queueName],
      [jobName]: job.handler,
    } as unknown as { [key: string]: JobHandler };
    
    const worker = queue.createWorker(async (jobData: JobData) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!jobData.state.name || jobData.state.name === 'undefined') {
        throw new Error(`job.state.name is undefined`);
      }

      // Create logger instance
      const logger = await this.logger(jobData);

      // Pass job state with logger to handler
      return this.handlers[queueName][jobData.state.name]({
        ...jobData.state,
        logger
      }, this.ctx);
    }, { concurrency: this.concurrency });

    this.workers[queueName] = worker;
  }

  addJob(path: string, data: unknown = {}, options: JobType['options'] = {}): void {
    const optionsLayer = {
      delayUntil: new Date(),
      lockUntil: new Date(),
      retryCount: 0,
      repeatCount: 0,
    };
    const nameQueue = path.split('/')[0];
    const jobName = path.split('/')[1];
    const queue = this.queues[nameQueue].queue;

    if (!queue) {
      throw new Error(`Queue ${nameQueue} not found`);
    }

    if (options?.repeat?.pattern) {
      optionsLayer.delayUntil = parseCronExpression(options?.repeat?.pattern)
        .getNextDate(new Date());
      optionsLayer.lockUntil = parseCronExpression(options?.repeat?.pattern)
        .getNextDate(new Date());
      optionsLayer.repeatCount = 1;
    }

    if (options?.attempts) {
      optionsLayer.retryCount = options?.attempts;
    }
    queue.pushJob({
      name: jobName,
      data,
      ...(options ? { options } : {}),
    }, { ...optionsLayer });
  }

  processJobs(): void {
    for (const worker of Object.values(this.workers)) {
      worker.processJobs();
    }
  }

  async logger(job: JobData): Promise<(message: string | object) => Promise<void>> {
    // Get the job key
    const key = `queues:${job.id.replace(job.state.name, job.state.path.replace('/', ':'))}:${job.status}`;
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Return the actual logging function
    return async (message: string | object) => {
      // Get the latest job state for each log
      const currentJobState = await this.db.get(key);
      const jobStateObject = JSON.parse(currentJobState ?? '{"logs": []}');

      // Create log entry with timestamp
      const logEntry = {
        timestamp: Date.now(),
        message: typeof message === 'string' ? message : JSON.stringify(message)
      };

      // Add to logs array
      jobStateObject.logs.push(JSON.stringify(logEntry));
// console.log(key, jobStateObject.logs)
      // Save updated state
      await this.db.set(key, JSON.stringify(jobStateObject));
    };
  }

  // handle Status queues

  pauseQueue(queueName: string): void {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} not found`);
    }
    this.queues[queueName].queue.pause();
  }

  resumeQueue(queueName: string): void {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} not found`);
    }
    this.queues[queueName].queue.resume();
  }

  // Handle jobs Data
  
  async getJobsForUI() {
    try {
        const foundJobs = await this.getJobs();
        const jobs = foundJobs.filter((job: any) => job.state?.path);
        const pausedQueues = foundJobs
            .filter((statuses: any) => !statuses.state?.path)
            .map((statuses: any) => statuses.id);

        // Transform jobs for UI consumption
        const uiJobs = jobs.map((job: any) => ({
          //write a regex to  remove the :waiting, :processing, :failed, :completed, :delayed from the id
            id: job.id.replace(/:waiting|:processing|:failed|:completed|:delayed/g, ''), 
            state: job.state,
            status: job.status,
            priority: job.priority,
            addedAt: job?.addedAt,
            delayUntil: job.delayUntil,
            lockUntil: job.lockUntil,
            lastRun: job?.lastRun,
            retriedAttempts: job?.retriedAttempts,
            repeatCount: job.repeatCount,
            repeatDelayMs: job.repeatDelayMs,
            retryCount: job.retryCount,
            retryDelayMs: job.retryDelayMs,
            timestamp: job.timestamp,
            logs: job.logs,
            errors: job.errors
        }));

        // Group jobs by queue and status
        const dividedByQueuesAndStatus = uiJobs.reduce((acc: any, job: any) => {
            const queueName = job.state?.path?.split('/')[0];
            if (!acc[queueName]) {
                acc[queueName] = {
                    waiting: [],
                    processing: [],
                    failed: [],
                    completed: [],
                    delayed: []
                };
            }
            
            // Push job to appropriate status array
            const status = job.status.toLowerCase();
            if (acc[queueName][status]) {
                acc[queueName][status].push(job);
            }
            
            return acc;
        }, {});

        // Format final response
        const queues = Object.keys(dividedByQueuesAndStatus).map((queue: any) => ({
            name: queue,
            paused: pausedQueues.includes(`queues:${queue}:paused`),
            jobs: dividedByQueuesAndStatus[queue] // This now contains the status arrays
        }));

        // console.log('Formatted queues:', JSON.stringify(queues, null, 2));
        return queues;
    } catch (error) {
        console.error('Error monitoring jobs:', error);
        return [];
    }
  }

  async getJobs() {
  const activeJobs = [];
  let cursor = '0';
  
  do {
    // Get batch of keys using SCAN
    const [nextCursor, keys] = await this.db.scan(
      cursor,
      'MATCH',
      'queues:*',
      'COUNT',
      '1000'
    );
    
    cursor = nextCursor;
    
    if (keys.length > 0) {
      // Use Redis pipelining or MGET for batch retrieval
      // Option 1: If your Redis client supports pipelining
      if (typeof this.db.pipeline === 'function') {
        const pipeline = this.db.pipeline();
        keys.forEach(key => pipeline.get(key));
        const results = await pipeline.exec();
        
        results.forEach((result, i) => {
          if (result && result[1]) {
            try {
              activeJobs.push({
                ...JSON.parse(result[1]),
                id: keys[i]
              });
            } catch (err) {
              console.error(`Failed to parse job data for key ${keys[i]}:`, err);
            }
          }
        });
      } 
      // Option 2: If your Redis client supports MGET
      else if (typeof this.db.mget === 'function') {
        const values = await this.db.mget(...keys);
        
        values.forEach((value, i) => {
          if (value) {
            try {
              activeJobs.push({
                ...JSON.parse(value),
                id: keys[i]
              });
            } catch (err) {
              console.error(`Failed to parse job data for key ${keys[i]}:`, err);
            }
          }
        });
      }
      // Option 3: Fallback to original implementation
      else {
        for (const key of keys) {
          const job = await this.db.get(key);
          if (job) {
            try {
              activeJobs.push({
                ...JSON.parse(job),
                id: key
              });
            } catch (err) {
              console.error(`Failed to parse job data for key ${key}:`, err);
            }
          }
        }
      }
    }
  } while (cursor !== '0');
  
  return activeJobs;
  }
  
  async getJobById(id: string) {
    const foundJob = await this.db.get(`${id}`);
    return foundJob ? JSON.parse(foundJob) : null;
  }

  async togglePauseJobById(id: string) {
    const foundJob = await this.db.get(`${id}`);
    if(!foundJob) return null;
    const jobData = JSON.parse(foundJob);
    if(!['waiting','delayed'].includes(jobData.status)) {
      throw new Error(`Job ${id} is not in waiting or delayed status`);
    }
    if(jobData.state.paused) {
      jobData.state.paused = false;
    } else {
      jobData.state.paused = true;
    }
    await this.db.set(`${id}`, JSON.stringify(jobData));
    return jobData.state.paused ? 'OK' : null;
  }

  async deleteJobById(id: string) {
    const deletedJob = await this.db.del(`${id}`);
    
    if(deletedJob) {
      await this.db.del(`${id}-stream`);
    }

    return deletedJob ? 'OK' : null;
  }

  async deleteAllJobs(queueStatus: string) {
   try{ 
    const queueName = queueStatus.split(':')[0];
    const status = queueStatus.split(':')[1];
    const foundJobs = await this.getJobsForUI();
    const filteredJobs = foundJobs.find((q) => q.name === queueName);
    await Promise.all(filteredJobs?.jobs[status].map((job: any) => this.deleteJobById(`${job.id}:${status}`)));
    return 'OK';}
    catch(err) {
      console.error('Error deleting all jobs:', err);
      return null;
    }
  }
}

