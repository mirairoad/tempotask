// deno-lint-ignore-file ban-ts-comment
import { parseCronExpression } from 'cron-schedule';
import {
ExtJobData,
  JobData,
  JobHandler,
  NextJobEntry,
  RedisConnection,
  WorkerEvent,
  WorkerEventMap,
  WorkerOptions
} from '../types/index.ts';
import { delay, isRedisConnection, retry } from '../utils/index.ts';
export class Worker extends EventTarget {
  /**
   * Redis client to use for accessing the queue.
   */
  readonly db: RedisConnection;

  /**
   * Key prefix to use for accessing queue's data.
   */
  readonly key: string;

  readonly streamdb: RedisConnection;

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
   * Cache of jobs.
   */
  cache: Map<string, number> = new Map<string, number>();

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
    streamdb?: RedisConnection,
  ) {
    super();
    if (!isRedisConnection(db)) {
      throw new Error(
        'Database connection must implement RedisConnection interface',
      );
    }
    this.db = db;
    this.streamdb = streamdb || db;
    this.key = key;
    this.handler = handler;
    this.options = {
      concurrency: options.concurrency ?? 1,
      lockDurationMs: options.lockDurationMs ?? 5_000,
      lockIntervalMs: options.lockIntervalMs ?? 2_000,
      pollIntervalMs: options.pollIntervalMs ?? 3_000,
    };
    this.cache = new Map<string, number>();
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
        console.log(this.db.options?.db, this.streamdb.options?.db);
        // Check abort signal
        if (signal?.aborted || controller.signal.aborted) {
          break;
        }

        // Check if queue is paused
        const pausedKey = `queues:${this.key}:paused`;
        const isPaused = await this.db.get(pausedKey);

        if (isPaused) {
          await delay(this.options.pollIntervalMs);
          continue;
        }

        try {
          // Get jobs from the stream using consumer group
          const jobs: JobData[] = await this.readQueueStream(this.key);
          // console.log(jobs);

          if (jobs.length === 0) {
            await delay(this.options.pollIntervalMs);
            continue;
          }

          // Process jobs that are ready
          for (const job of jobs) {
            // console.log(job.paused);
            if(job.paused) {
              await delay(this.options.pollIntervalMs);
              continue;
            }
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
              await delay(1000);
              // await this.db.del(`queues:${this.key}:${job.id}:waiting`);
              job.status = 'delayed';
              // Use the original job timestamp instead of creating a new one
              const cacheKey = `queues:${this.key}:${job.id}:${job.status}`;
              
              if (!this.cache.has(cacheKey)) {
                // Store the original timestamp
                this.cache.set(cacheKey, job.timestamp);
                this.db.set(cacheKey, JSON.stringify(job));
              }else if (job.timestamp !== this.cache.get(cacheKey)) {
                this.cache.set(cacheKey, job.timestamp);
                this.db.set(cacheKey, JSON.stringify(job));
              }
              // console.log('Caching timestamp:', job.timestamp, this.cache.get(cacheKey));

              // Keep the original timestamp when re-adding to stream
              await this.streamdb.xadd(
                `${this.key}-stream`,
                '*',
                'data',
                JSON.stringify({
                  ...job,
                  // Don't update the timestamp, keep the original
                  // lastRun: Date.now(),
                  timestamp: job.timestamp 
                })
              );
              continue;
            }
            // console.log(`queues:${this.key}:${job.id}:${job.status}`)

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
      await this.db.del(`queues:${this.key}:${jobEntry.id}:${jobEntry.status}`);
      // Update status to processing

      const processingData = {
        ...jobEntry,
        logs: [...(jobEntry.logs || []), {
          message: 'processing',
          timestamp: Date.now(),
        }],
        lastRun: Date.now(),
        status: 'processing',
      };
      
      // Store processing state
      const processingKey = `queues:${this.key}:${processingData.id}:${processingData.status}`;
      await this.db.set(processingKey, JSON.stringify(processingData));
      // console.log(`queues:${this.key}:${processingData.id}:${processingData.status}`)
      // Process the job
      await this.handler(processingData as unknown as ExtJobData, {});

      // Update to completed state
      const completedData = {
        ...processingData,
        logs: [...(processingData.logs || []), {
          message: 'the task has been completed',
          timestamp: Date.now()
        }],
        status: 'completed',
      };

      // Store completed state
      await this.db.del(`queues:${this.key}:${completedData.id}:${completedData.status}`);
      await this.db.del(`queues:${this.key}:${completedData.id}:processing`);
      const completedKey = `queues:${this.key}:${completedData.id}:${crypto.randomUUID()}:${completedData.status}`;
      await this.db.set(completedKey, JSON.stringify(completedData));
      
      // Dispatch complete event
      this.dispatchEvent(
        new CustomEvent('complete', {
          detail: {
            job: {
              ...completedData,
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
          lockUntil: cron.getNextDate(new Date()).getTime(),
          delayUntil: jobEntry?.state?.options?.repeat?.pattern
            ? cron.getNextDate(new Date()).getTime()
            : Date.now() + jobEntry.repeatDelayMs,
          repeatCount: jobEntry?.state?.options?.repeat?.pattern
            ? jobEntry.repeatCount
            : jobEntry.repeatCount - 1,
          timestamp: Date.now(),
          status: 'delayed',
          lastRun: Date.now(),
        };

        await this.streamdb.xadd(
          `${this.key}-stream`,
          '*',
          'data',
          JSON.stringify(newJob),
        );
      }

      // After successful processing, remove from stream
      if (jobEntry.messageId) {
        await this.streamdb.xack(
          `${this.key}-stream`,
          'workers',
          jobEntry.messageId
        );
        await this.streamdb.xdel(
          `${this.key}-stream`,
          jobEntry.messageId
        );
      }
    } catch (error: unknown) {
      // Handle failed state
      const failedData = {
        ...jobEntry,
        status: 'failed',
        timestamp: Date.now(),
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: Date.now()
          }
        ]
      };

      const failedKey = `queues:${this.key}:${jobEntry.id}:${crypto.randomUUID()}:${failedData.status}`;
      await this.db.set(failedKey, JSON.stringify(failedData));

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
            delayUntil: Date.now() + jobEntry.retryDelayMs,
            lockUntil: Date.now(),
            retryCount: jobEntry.retryCount - 1,
            retriedAttempts: jobEntry?.retriedAttempts + 1,
            logs: [...(jobEntry.logs || []), {
              message: `retrying ${jobEntry.retryCount} more times`,
              timestamp: Date.now()
            }],
          };

          await this.streamdb.xadd(
            `${this.key}-stream`,
            '*',
            'data',
            JSON.stringify(retryJob),
          );
        }

        // Don't remove failed messages if they can be retried
        if (!jobEntry.retryCount) {
          await this.streamdb.xack(
            `${this.key}-stream`,
            'workers',
            jobEntry.messageId
          );
          await this.streamdb.xdel(
            `${this.key}-stream`,
            jobEntry.messageId
          );
        }
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

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.streamdb.xgroup(
        'CREATE', 
        `${this.key}-stream`, 
        'workers', 
        '0', 
        'MKSTREAM'
      );
    } catch (err: unknown) {
      // If group exists, that's fine - just continue
      if (err instanceof Error && err.message.includes('BUSYGROUP')) {
        return; // Group already exists, which is what we want
      }
      // Only log and throw for other errors
      console.error('Error creating consumer group:', err);
      throw err;
    }
  }

  private async readQueueStream(
    queueName: string,
    count: number = 200,
    block: number = 5000,
  ): Promise<Array<JobData>> {
    // Ensure consumer group exists before reading
    await this.ensureConsumerGroup();
    
    const consumerId = `worker-${crypto.randomUUID()}`; // More unique consumer ID
    
    try {
      // First try to claim any pending messages
      const pendingMessages = await this.streamdb.xpending(
        `${queueName}-stream`,
        'workers',
        '-',
        '+',
        count
      );

      if (pendingMessages?.length) {
        // Claim messages that have been pending too long
        const now = Date.now();
        const claimIds = pendingMessages
          .filter((msg: { lastDelivered: number }) => (now - msg.lastDelivered) > 30000) // 30 seconds threshold
          .map((msg: { id: string }) => msg.id);

        if (claimIds.length) {
          await this.streamdb.xclaim(
            `${queueName}-stream`,
            'workers',
            consumerId,
            30000, // Min idle time
            claimIds
          );
        }
      }

      // Then read new messages
      const jobs = await this.streamdb.xreadgroup(
        'GROUP',
        'workers',
        consumerId,
        'COUNT',
        count,
        'BLOCK',
        block,
        'STREAMS',
        `${queueName}-stream`,
        '>'  // Only new messages
      ) as [string, [string, string]][];

      if (!jobs?.[0]?.[1]?.length) {
        return [];
      }

      const processedJobs = this.sanitizeStream(jobs);

      // Acknowledge processed messages
      const messageIds = jobs[0][1].map(([id]) => id);
      await this.streamdb.xack(
        `${queueName}-stream`,
        'workers',
        ...messageIds
      );

      return processedJobs;
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
