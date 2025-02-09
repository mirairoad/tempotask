import {
  CronJobType,
  JobData,
  JobEntry,
  JobOptions,
  RedisConnection,
} from './types.ts';
import { parseCronExpression } from 'cron-schedule';
import { Queue } from './queue.ts';
import { Worker } from './worker.ts';
export class JobQueueManager {
  private static instance: JobQueueManager;
  private queues: { [key: string]: { [key: string]: Queue } } = {};
  private workers: { [key: string]: Worker } = {};
  private handlers: {
    [key: string]: { [key: string]: (ctx: unknown, job: unknown) => void };
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
  ): JobQueueManager {
    if (!JobQueueManager.instance) {
      JobQueueManager.instance = new JobQueueManager(db, ctx, concurrency);
    }
    return JobQueueManager.instance;
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

  registerJob(job: CronJobType): void {
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
        this.addJob(job.path, {}, job.options); //this will only use the handler(run) and options
      } else {
        // comeback here later
        // this.queues[queueName][key].removeDuplicate(jobName, job);
      }
    }

    this.handlers[queueName] = {
      ...this.handlers[queueName],
      [jobName]: job.run,
    };
    // console.log(this.handlers[queueName])
    // console.log(jobName)
    const worker = queue.createWorker(async (job: JobData) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!job.state.name || job.state.name === 'undefined') {
        throw new Error(`job.state.name is undefined`);
      }

      return this.handlers[queueName][job.state.name](this.ctx, job.state);
    }, { concurrency: this.concurrency });

    // console.log(this.handlers[queueName][jobName]({}, {}))
    this.workers[queueName] = worker;
  }

  addJob(path: string, data: unknown = {}, options: JobOptions = {}): void {
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

  // Utilities
  // async getAllJobs(): Promise<Array<JobEntry>> {
  //   return (await Promise.all(
  //     Object.values(this.queues).flatMap((queue) => queue.queue.getAllJobs()),
  //   )).flat();
  // }
}
