// deno-lint-ignore-file ban-ts-comment
import { parseCronExpression } from 'cron-schedule';
import { RedisConnection, NextJobEntry, JobData, JobHandler, WorkerOptions, WorkerEventMap, WorkerEvent } from './types.ts';
import { isRedisConnection, genJobId, delay, retry } from './utils.ts';

const JOBS_KEY = 'jobs' as const;

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
        throw new Error('Database connection must implement RedisConnection interface');
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
      // console.log(`Queue ${this.key}: Processing started`);
      this.#isProcessing = true;
      try {
        while (true) {
          // Check concurrency limit
          if (this.#activeJobs.size >= this.options.concurrency) {
            if (this.#activeJobs.size > 0) {
              await Promise.race(this.#activeJobs);
            } else {
              await delay(this.options.pollIntervalMs);
              continue;
            }
          }
  
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
  
          // Find job to process
          let nextJobEntry: NextJobEntry | undefined = undefined;
          let cursor = '0';
          const jobKeyPattern = `${this.key}:${JOBS_KEY}:*`; // triggering twice because of the scan I need to match the name of the job
          // console.log(jobKeyPattern);
          do {
            const [nextCursor, keys] = await this.db.scan(
              '0',
              'MATCH',
              jobKeyPattern,
              'COUNT',
              100,
            );
            cursor = nextCursor;
  
            for (const key of keys) {
              const jobValue = await this.db.get(key);
              if (!jobValue) continue;
  
              const jobData = JSON.parse(jobValue) as JobData;
  
              if (
                new Date(jobData.lockUntil) > new Date() ||
                new Date(jobData.delayUntil) > new Date()
              ) {
                continue;
              }
  
              nextJobEntry = {
                key,
                value: jobData,
              };
              break;
            }
          } while (cursor !== '0' && !nextJobEntry);
  
          if (!nextJobEntry) {
            await delay(this.options.pollIntervalMs);
            continue;
          }
  
          // Lock the job
          try {
            // Watch the key before starting transaction
            await this.db.watch(nextJobEntry.key);
  
            const updatedJob = {
              ...nextJobEntry.value,
              lockUntil: new Date(Date.now() + this.options.lockDurationMs),
            };
  
            // Start transaction and chain commands
            const lockResult = await this.db.multi()
              .set(nextJobEntry.key, JSON.stringify(updatedJob))
              .exec();
  
            if (!lockResult || lockResult.length === 0) {
              await this.db.unwatch();
              continue;
            }
  
            // Keep job locked with interval
            const lockInterval = setInterval(async () => {
              try {
                await this.db.watch(nextJobEntry.key);
                const currentJob = await this.db.get(nextJobEntry.key);
  
                if (!currentJob) {
                  await this.db.unwatch();
                  return;
                }
  
                const jobData = JSON.parse(currentJob);
                const result = await this.db.multi()
                  .set(
                    nextJobEntry.key,
                    JSON.stringify({
                      ...jobData,
                      lockUntil: new Date(
                        Date.now() + this.options.lockDurationMs,
                      ),
                    }),
                  )
                  .exec();
                if (!result) {
                  throw new Error('Lock renewal failed');
                }
              } catch (error) {
                console.error(`Failed to update lock: ${error}`);
              }
            }, this.options.lockIntervalMs);
  
            // Process the job
            const jobPromise = this.#processJob(nextJobEntry).finally(() => {
              // console.log('nextJobEntry---------------------', nextJobEntry);
              clearInterval(lockInterval);
              this.#activeJobs.delete(jobPromise);
            });
  
            this.#activeJobs.add(jobPromise);
          } catch (error) {
            console.error('Error processing job:', error);
            await this.db.unwatch();
            continue;
          }
        }
      } finally {
        this.#isProcessing = false;
      }
  
      console.log(`Queue ${this.key}: Processing stopped`);
    }
  
    async #processJob(jobEntry: { key: string; value: JobData }): Promise<void> {
      try {
        // console.log(`Job ${jobEntry.key}: Started`);
  
        // Process the job
        await this.handler(
          {
            ...jobEntry.value,
            id: jobEntry.key.split(':').slice(2), // Extract ID parts from Redis key
          },
          async (job: Partial<JobData>) => {
            await retry(async () => {
              // Lock and update job state
              await this.db.watch(jobEntry.key);
  
              const currentJob = await this.db.get(jobEntry.key);
              if (!currentJob) {
                throw new Error('Entry not found');
              }
  
              const currentJobData = JSON.parse(currentJob);
              const multi = this.db.multi();
  
              const updatedJob = {
                state: job.state ?? currentJobData.state,
                delayUntil: job.delayUntil ?? currentJobData.delayUntil,
                lockUntil: job.lockUntil ??
                  new Date(Date.now() + this.options.lockDurationMs),
                repeatCount: job.repeatCount ?? currentJobData.repeatCount,
                repeatDelayMs: job.repeatDelayMs ?? currentJobData.repeatDelayMs,
                retryCount: job.retryCount ?? currentJobData.retryCount,
                retryDelayMs: job.retryDelayMs ?? currentJobData.retryDelayMs,
              };
  
              multi.set(jobEntry.key, JSON.stringify(updatedJob));
              const result = await multi.exec();
  
              if (!result) {
                throw new Error('Atomic update failed');
              }
            });
          },
          {
            stopProcessing: () => {
              this.stopProcessing();
            },
          },
        );
  
        // Job completed
        // console.log(`Job ${jobEntry.key}: Completed`);
  
        // Get final job state
        const finishedJob = await this.db.get(jobEntry.key);
        if (!finishedJob) {
          return;
        }
  
        const finishedJobData = JSON.parse(finishedJob);
  
        // Delete completed job
        await this.db.del(jobEntry.key);
  
        // Dispatch complete event
        this.dispatchEvent(
          new CustomEvent('complete', {
            detail: {
              job: {
                id: jobEntry.key.split(':').slice(2),
                ...finishedJobData,
              },
            },
          }),
        );
  
        // Handle job repetition
        if (finishedJobData.repeatCount > 0) {
          // console.log(`Job ${jobEntry.key}: Repeating ${finishedJobData.repeatCount} more times`);
  
          const cron = parseCronExpression(
            finishedJobData?.state?.options?.repeat?.pattern,
          );
          const newJobKey = [
            ...jobEntry.key.split(':').slice(0, 3),
            genJobId(
              finishedJobData?.state?.name,
              finishedJobData?.state?.data,
            ),
          ].join(':');
  
          await this.db.set(
            newJobKey,
            JSON.stringify({
              ...finishedJobData,
              lockUntil: cron.getNextDate(new Date()),
              delayUntil: finishedJobData?.state?.options?.repeat?.pattern
                ? cron.getNextDate(new Date())
                : new Date(Date.now() + finishedJobData.repeatDelayMs),
              repeatCount: finishedJobData?.state?.options?.repeat?.pattern
                ? finishedJobData.repeatCount
                : finishedJobData.repeatCount - 1,
            }),
          );
        }
      } catch (error) {
        console.log(`Job ${jobEntry.key}: Failed: ${error}`);
  
        // Handle failed job
        const failedJob = await this.db.get(jobEntry.key);
        if (!failedJob) {
          return;
        }
  
        const failedJobData = JSON.parse(failedJob);
  
        // Dispatch error event
        this.dispatchEvent(
          new CustomEvent('error', {
            detail: {
              error,
              job: {
                id: jobEntry.key.split(':').slice(2),
                ...failedJobData,
              },
            },
          }),
        );
  
        try {
          // Handle job retry
          if (failedJobData.retryCount > 0) {
            console.log(
              `Job ${jobEntry.key}: Retrying ${failedJobData.retryCount} more times`,
            );
  
            await retry(async () => {
              await this.db.watch(jobEntry.key);
  
              const currentJob = await this.db.get(jobEntry.key);
              if (!currentJob) {
                throw new Error('Entry not found');
              }
  
              const currentJobData = JSON.parse(currentJob);
              const multi = this.db.multi();
  
              multi.set(
                jobEntry.key,
                JSON.stringify({
                  ...currentJobData,
                  delayUntil: new Date(Date.now() + currentJobData.retryDelayMs),
                  lockUntil: new Date(),
                  retryCount: currentJobData.retryCount - 1,
                }),
              );
  
              const result = await multi.exec();
              if (!result) {
                throw new Error('Atomic update failed');
              }
            });
          } else {
            // Delete failed job if no retries left
            await this.db.del(jobEntry.key);
          }
        } catch (retryError) {
          console.log(`Job ${jobEntry.key}: Failed to retry: ${retryError}`);
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