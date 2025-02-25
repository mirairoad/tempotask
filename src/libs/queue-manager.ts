import {
  JobData,
  JobHandler,
  JobOptions,
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
  private constructor(db: RedisConnection, ctx: unknown, concurrency: number) {
    this.db = db;
    this.ctx = ctx;
    this.concurrency = concurrency;
  }

  static init(
    db: RedisConnection,
    ctx: unknown = {},
    concurrency: number = 1,
  ): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(db, ctx, concurrency);
    }
    return QueueManager.instance;
  }

  async createConsumerGroup(queueName: string): Promise<void> {
    if (!queueName) {
      throw new Error('queueName is required');
    }
    try {
      await this.db.xgroup(
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

  registerJob(job: { path: string, handler: (ctx: unknown, job: JobState) => void, options?: JobOptions }): void {
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
      queue = new Queue(this.db, queueName);
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
    
    const worker = queue.createWorker(async (job: JobData, update, helpers) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!job.state.name || job.state.name === 'undefined') {
        throw new Error(`job.state.name is undefined`);
      }

      return this.handlers[queueName][job.state.name](job, update, helpers);
    }, { concurrency: this.concurrency });

    // console.log(this.handlers[queueName][jobName]({}, {}))
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

  async getJobs(): Promise<Array<unknown>> {
    const activeJobs: Array<unknown> = [];
    let cursor = '0';
    
    do {
      // Get batch of keys using SCAN
      const [nextCursor, keys] = await this.db.scan(
        cursor,
        'MATCH',
        'queues:*',
        'COUNT',
        200
      );
      
      cursor = nextCursor;

      // Process each job in this batch
      for await (const jobKey of keys) {
        // Skip state tracking hashes
        if (jobKey.endsWith(':states')) continue;
        
        const jobData = await this.db.get(jobKey);
        if (jobData) {
          try {
            activeJobs.push({
              ...JSON.parse(jobData),
              id: jobKey
            });
          } catch (err) {
            console.error(`Failed to parse job data for key ${jobKey}:`, err);
          }
        }
      }
      
      // Continue until cursor is 0
    } while (cursor !== '0');

    return activeJobs;
  }
  
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
            retryDelayMs: job.retryDelayMs
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

  async getJobById(id: string) {
    const foundJobs = await this.getJobs();
    return foundJobs.find((job: any) => job.id === id);
  }

  processJobs(): void {
    for (const worker of Object.values(this.workers)) {
      worker.processJobs();
    }
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
}
