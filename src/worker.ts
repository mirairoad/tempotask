// deno-lint-ignore-file ban-ts-comment
import { parseCronExpression } from 'cron-schedule';
import {
  JobData,
  JobHandler,
  NextJobEntry,
  RedisConnection,
  WorkerEvent,
  WorkerEventMap,
  WorkerOptions,
} from './types.ts';
import { delay, genJobId, isRedisConnection, retry } from './utils.ts';
import config from './config.ts';
import { join } from 'node:path';

const { CONSUMER_GROUP } = config;
export class Worker extends EventTarget {
  /**
   * Redis client to use for accessing the queue.
   */
  readonly db: RedisConnection;

  /**
   * Key prefix to use for accessing queue's data.
   */
  readonly key: string;

  /**
   * The function that processes the jobs.
   */
  handler: JobHandler;

  /**
   * Worker options.
   */
  options: Required<WorkerOptions>;

  /**
   * Promise for finishing currently running processors.
   */
  #processingFinished = Promise.resolve();

  /**
   * Whether the worker is currently processing jobs.
   */
  #isProcessing = false;

  /**
   * Abort controller for stopping currently running processors.
   */
  #processingController = new AbortController();

  /**
   * Set of currently running jobs as promises.
   */
  readonly #activeJobs = new Set<Promise<void>>();

  /**
   * Constructs a new worker for the given queue.
   *
   * DB and key must match the ones used to construct the queue.
   * You can also use {@link Queue.createWorker} as a shorthand to construct a worker for a queue.
   *
   * This constructor is useful if your worker is in separate process from the queue.
   */
  constructor(
    db: unknown,
    key: string,
    handler: JobHandler,
    options: WorkerOptions = {},
  ) {
    super();
    if (!isRedisConnection(db)) {
      throw new Error(
        'Database connection must implement RedisConnection interface',
      );
    }
    this.db = db;
    this.key = key;
    this.handler = handler;
    this.options = {
      concurrency: options.concurrency ?? 1,
      lockDurationMs: options.lockDurationMs ?? 5_000,
      lockIntervalMs: options.lockIntervalMs ?? 2_000,
      pollIntervalMs: options.pollIntervalMs ?? 3_000,
    };
  }

  /**
   * Starts processing jobs.
   *
   * If you already called this method and it's still running,
   * the current call will first wait for previous one to finish.
   *
   * Pass an abort signal to stop processing jobs at a later time.
   * Aborting won't wait for the already started jobs to finish processing.
   * To also wait for all currently running jobs, use `await Promise.all(worker.activeJobs)`.
   *
   * Returns a promise that resolves when the job popping loop exits.
   * The only ways to exit this loop is to use the signal argument or {@link stopProcessing}.
   * It can reject when getting or updating jobs in the database fails.
   * Whenever an error occurs in the processing handler, the worker will emit an `error` event.
   */
  processJobs(options: { signal?: AbortSignal } = {}): Promise<void> {
    const { signal } = options;
    const controller = this.#processingController;
    this.#processingFinished = this.#processingFinished.then(() =>
      this.#processJobsLoop({ signal, controller })
    );
    return this.#processingFinished;
  }

  async #processJobsLoop(
    options: { signal?: AbortSignal; controller: AbortController },
  ) {
    const { signal, controller } = options;
    this.#isProcessing = true;

    try {
      while (true) {
        // Check abort signal
        if (signal?.aborted || controller.signal.aborted) {
          break;
        }

        // Check if queue is paused
        const pausedKey = `${this.key}:paused`;
        const isPaused = await this.db.get(pausedKey);
        
        if (isPaused) {
          await delay(this.options.pollIntervalMs);
          continue;
        }

        try {
          // Get jobs from the stream using consumer group
          const jobs: JobData[] = await this.readQueueStream(this.key);
          
          if (jobs.length === 0) {
            await delay(this.options.pollIntervalMs);
            continue;
          }

          // Process jobs that are ready
          for (const job of jobs) {
            // Wait if we've hit concurrency limit
            while (this.#activeJobs.size >= this.options.concurrency) {
              await Promise.race([
                Promise.race(this.#activeJobs),
                delay(this.options.pollIntervalMs)
              ]);
              
              // Check abort signal again after waiting
              if (signal?.aborted || controller.signal.aborted) {
                return;
              }
            }

            const now = new Date();
            const jobDelay = new Date(job.delayUntil);

            // Skip jobs that aren't ready yet
            if (jobDelay > now) {
              // Return delayed job to stream for later processing
              await this.db.xadd(
                `${this.key}-stream`,
                '*',
                'data',
                JSON.stringify(job)
              );
              continue;
            }

            // Create a promise for this job's processing
            const jobPromise = (async () => {
              try {
                await this.#processJob(job);
              } catch (error) {
                console.error(`Job ${job.id} processing error:`, error);
              } finally {
                // @ts-ignore
                this.#activeJobs.delete(jobPromise);
              }
            })();
        

            // Track the active job
            this.#activeJobs.add(jobPromise);
          }
        } catch (error) {
          console.error('Error in processing loop:', error);
          await delay(this.options.pollIntervalMs);
        }
      }
    } finally {
      this.#isProcessing = false;
    }
  }

  async #processJob(jobEntry: JobData): Promise<void> {
    try {
      // Process the job
      await this.handler(
        {
          ...jobEntry,
        },
        async (job: Partial<JobData>) => {
          await retry(async () => {

            const updatedJob = {
              state: job.state ?? jobEntry.state,
              delayUntil: job.delayUntil ?? jobEntry.delayUntil,
              lockUntil: job.lockUntil ??
                new Date(Date.now() + this.options.lockDurationMs),
              repeatCount: job.repeatCount ?? jobEntry.repeatCount,
              repeatDelayMs: job.repeatDelayMs ?? jobEntry.repeatDelayMs,
              retryCount: job.retryCount ?? jobEntry.retryCount,
              retryDelayMs: job.retryDelayMs ?? jobEntry.retryDelayMs,
            };
            await this.db.xadd(
              `${this.key}-stream`,
              '*',
              'data',
              JSON.stringify(updatedJob),
            );
          });
        },
        {
          stopProcessing: () => {
            this.stopProcessing();
          },
        },
      );

      // Job completed
      // console.log(jobEntry)
      // await this.db.xdel(`${this.key}-stream`, jobEntry.messageId);
      await this.db.xack(
        `${this.key}-stream`,
        CONSUMER_GROUP,
        jobEntry.messageId
      );
      await this.db.hset(
        jobEntry.id,
        'data',
        JSON.stringify({ ...jobEntry, status: 'completed' }),
      );
      // console.log(await this.db.hgetall(jobEntry.id));
      // Dispatch complete event
      this.dispatchEvent(
        new CustomEvent('complete', {
          detail: {
            job: {
                  ...jobEntry,
            },
          },
        }),
      );

      // Handle job repetition
      if (
        jobEntry.repeatCount > 0 && jobEntry?.state?.options?.repeat?.pattern
      ) {
        const cron = parseCronExpression(
          jobEntry.state.options.repeat.pattern,
        );

        const newJob = {
          ...jobEntry,
          lockUntil: cron.getNextDate(new Date()),
          delayUntil: jobEntry?.state?.options?.repeat?.pattern
            ? cron.getNextDate(new Date())
            : new Date(Date.now() + jobEntry.repeatDelayMs),
          repeatCount: jobEntry?.state?.options?.repeat?.pattern
            ? jobEntry.repeatCount
            : jobEntry.repeatCount - 1,
        };
// console.log(newJob)
        await this.db.xadd(
          `${this.key}-stream`,
          '*',
          'data',
          JSON.stringify(newJob),
        );
      }
    } catch (error) {
      console.log(`Job ${jobEntry.id}: Failed: ${error}`);

      // Dispatch error event
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: {
            error,
            job: jobEntry,
          },
        }),
      );

      try {
        // Handle job retry
        if (jobEntry.retryCount > 0) {
          console.log(
            `Job ${jobEntry.id}: Retrying ${jobEntry.retryCount} more times`,
          );

          const retryJob = {
            ...jobEntry,
            delayUntil: new Date(Date.now() + jobEntry.retryDelayMs),
            lockUntil: new Date(),
            retryCount: jobEntry.retryCount - 1,
          };

          await this.db.xadd(
            `${this.key}-stream`,
            '*',
            'data',
            JSON.stringify(retryJob),
          );
        }

        // Remove the failed message from stream
        await this.db.xdel(`${this.key}-stream`, jobEntry.messageId);
      } catch (retryError) {
        console.log(`Job ${jobEntry.id}: Failed to retry: ${retryError}`);
      }
    }
  }

  /**
   * Promise for finishing currently running processors.
   *
   * This promise gets replaced with a new one every time {@link processJobs} is called.
   * If you call and forget {@link processJobs}, you can use this to get the promise again and await it.
   *
   * This doesn't include the jobs that already started processing.
   * To wait for them too use {@link activeJobs}.
   */
  get processingFinished(): Promise<void> {
    return this.#processingFinished;
  }

  /**
   * Whether the worker is currently processing jobs.
   */
  get isProcessing(): boolean {
    return this.#isProcessing;
  }

  /**
   * Set of promises for finishing jobs that are currently being processed.
   *
   * When jobs are finished, they remove themselves from this set.
   *
   * To check the number of currently running jobs, use `worker.activeJobs.size()`.
   * To wait for all currently running jobs to finish, use `await Promise.all(worker.activeJobs)`.
   */
  get activeJobs(): ReadonlySet<Promise<void>> {
    return this.#activeJobs;
  }

  /**
   * Aborts all currently running processors.
   *
   * This is an alternative to passing an abort signal to {@link processJobs}.
   */
  stopProcessing(): void {
    this.#processingController.abort();
    this.#processingController = new AbortController();
  }

  private async readQueueStream(
    queueName: string,
    count: number = 200,
    block: number = 5000,
  ): Promise<Array<JobData>> {
    const consumerId = `worker-${Math.random().toString(36).substring(2, 15)}`;
    
    try {
      const jobs = await this.db.xreadgroup(
        'GROUP', 
        CONSUMER_GROUP, 
        consumerId,
        'COUNT',
        count,
        'BLOCK',
        block,
        'STREAMS',
        `${queueName}-stream`,
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

  /**
   * See {@link WorkerEventMap} for available events.
   */
  // @ts-ignore
  addEventListener<K extends keyof WorkerEventMap>(
    type: K,
    listener: (this: Worker, ev: WorkerEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  // @ts-ignore
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  // @ts-ignore
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options);
  }
}
