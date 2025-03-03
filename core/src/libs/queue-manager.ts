import type {
  JobData,
  JobHandler,
  JobOptions,
  ExtJobData,
  JobType,
  RedisConnection
} from '../types/index.ts';
import { parseCronExpression } from 'cron-schedule';
import { Queue } from './queue.ts';
import type { Worker } from './worker.ts';

/**
 * QueueManager class for managing job queues
 */
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
  private maxJobsPerStatus: number;
  private constructor(db: RedisConnection, ctx: any, concurrency: number, streamdb?: RedisConnection, maxJobsPerStatus: number = 200) {
    this.db = db;
    this.ctx = { ...ctx, addJob: this.addJob.bind(this) };
    this.concurrency = concurrency;
    this.streamdb = streamdb || db;
    this.maxJobsPerStatus = maxJobsPerStatus;
  }

  /**
   * Initializes the queue manager
   * @param db - Redis connection
   * @param ctx - Context object
   * @param concurrency - Number of concurrent jobs
   * @returns QueueManager instance
   */
  static init(
    db: RedisConnection,
    ctx: unknown = {},
    concurrency: number = 1,
    options: { maxJobsPerStatus: number } = { maxJobsPerStatus: 200 }
  ): QueueManager {
    if (!QueueManager.instance) {
      let streamdbIndex = db.options?.db;
      let streamdb;
      if(db?.options?.optimise) {
        streamdbIndex = db.options?.db ? db.options?.db + 1 : 1;
        if(streamdbIndex > 15) {
          throw new Error(`Redis database limit reached\n\n
              Optimise is enable means your "options.db + 1" is greater than 15
              \n\n
              Select a number between 0 and 14 when optimise is enable
              \n\n
              THIS IS A CUSTOM OPTIONS FOR REDIS CONNECTION
              \n\n
              const redisOption = {
                optimise: true,
                db: 0-14,
              } OR
              \n\n
              const redisOption = {
                optimise: false,
                db: 15,
              }
              \n\n
              `);
        }
        streamdb = db.duplicate({db: streamdbIndex});
      } else {
        streamdb = db;
      }
      QueueManager.instance = new QueueManager(db, ctx, concurrency, streamdb, options.maxJobsPerStatus);
    }
    return QueueManager.instance;
  }

  /**
   * Creates a consumer group for a queue
   * @param queueName - Name of the queue to create a consumer group for
   * @throws Error if queue name is not provided
   */
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

  /**
   * Registers a job with the queue manager
   * @param job - Job configuration
   * @throws Error if job path is invalid
   */
  registerJob(job: { path: string, handler: (job: ExtJobData, ctx: any) => void, options?: JobOptions }): void {
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
      }
      continue;
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

  /**
   * Adds a job to the queue
   * @param path - Path of the job
   * @param data - Data to pass to the job
   * @param options - Options for the job
   */
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


  /**
   * Processes all jobs in the queue
   */
  processJobs(): void {
    for (const worker of Object.values(this.workers)) {
      worker.processJobs();
    }
    
    // Trim jobs to keep the database size manageable
    this.trimJobs();
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

      const data = JSON.stringify(logEntry.message)
      // console.log(new Date().toISOString(), data)
      // Add to logs array
      jobStateObject.logs.push(data);
      // console.log(key, jobStateObject.logs)
      // Save updated state
      await this.db.set(key, JSON.stringify(jobStateObject));
    };
  }

  /**
   * Pauses a queue by name
   * @param queueName - Name of the queue to pause
   * @throws Error if queue not found
   */
  pauseQueue(queueName: string): void {
    try {
      if (!this.queues[queueName]) {
        throw new Error(`Queue ${queueName} not found`);
      }
      this.queues[queueName].queue.pause();
    } catch (error) {
      console.error('Error pausing queue:', error);
    }
  }

  /**
   * Resumes a queue by name
   * @param queueName - Name of the queue to resume
   * @throws Error if queue not found
   */
  resumeQueue(queueName: string): void {
    try {
      if (!this.queues[queueName]) {
        throw new Error(`Queue ${queueName} not found`);
      }
      this.queues[queueName].queue.resume();
    } catch (error) {
      console.error('Error resuming queue:', error);
    }
  }

  // Handle jobs Data
  
  /**
   * Gets jobs formatted for UI display, with automatic trimming when needed
   * @param maxJobsPerStatus Maximum number of jobs to display per status (default: 200)
   */
  async getJobsForUI(maxJobsPerStatus: number = this.maxJobsPerStatus): Promise<any[]> {
    try {
      const foundJobs = await this.getJobs();
      const jobs = foundJobs.filter((job: any) => job.state?.path);
      const pausedQueues = foundJobs
          .filter((statuses: any) => !statuses.state?.path)
          .map((statuses: any) => statuses.id);

      // Transform jobs for UI consumption
      const uiJobs = jobs.map((job: any) => ({
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

      // Track if we need to trim the database
      let needsTrimming = false;
      
      // Limit jobs per status for UI display and detect if trimming is needed
      for (const queue in dividedByQueuesAndStatus) {
        for (const status in dividedByQueuesAndStatus[queue]) {
          if (dividedByQueuesAndStatus[queue][status].length > maxJobsPerStatus) {
            // If any category exceeds limit, we'll need to trim the database
            needsTrimming = true;
            
            // Sort by addedAt (newest first)
            dividedByQueuesAndStatus[queue][status].sort((a: any, b: any) => 
              (b.addedAt || b.timestamp) - (a.addedAt || a.timestamp)
            );
            
            // Keep only the most recent jobs for UI display
            dividedByQueuesAndStatus[queue][status] = 
              dividedByQueuesAndStatus[queue][status].slice(0, maxJobsPerStatus);
          }
        }
      }

      // If we detected job counts exceeding limits, trigger trimming
      if (needsTrimming) {
        // Don't await this so it doesn't slow down the UI response
        this.trimJobs(maxJobsPerStatus).catch(err => 
          console.error('Error during background trimming:', err)
        );
      }

      // Format final response
      const queues = Object.keys(dividedByQueuesAndStatus).map((queue: any) => ({
          name: queue,
          paused: pausedQueues.includes(`queues:${queue}:paused`),
          stats:{
            total: dividedByQueuesAndStatus[queue].waiting.length + dividedByQueuesAndStatus[queue].processing.length + dividedByQueuesAndStatus[queue].failed.length + dividedByQueuesAndStatus[queue].completed.length + dividedByQueuesAndStatus[queue].delayed.length,
            waiting: dividedByQueuesAndStatus[queue].waiting.length,
            processing: dividedByQueuesAndStatus[queue].processing.length,
            failed: dividedByQueuesAndStatus[queue].failed.length,
            completed: dividedByQueuesAndStatus[queue].completed.length,
            delayed: dividedByQueuesAndStatus[queue].delayed.length
          },
          jobs: dividedByQueuesAndStatus[queue] // Now contains limited status arrays
      }));

      return queues;
    } catch (error) {
      console.error('Error monitoring jobs:', error);
      return [];
    }
  }

  /**
   * Gets all active jobs from the database
   * @returns Array of active jobs
   */
  async getJobs(): Promise<any[]> {
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
  
  /**
   * Gets a specific job by its ID
   * @param id - Job ID to retrieve
   * @returns Job data or null if not found
   */
  async getJobById(id: string): Promise<any | null> {
    try {
      const foundJob = await this.db.get(`${id}`);
      return foundJob ? JSON.parse(foundJob) : null;
    } catch (error) {
      console.error('Error getting job by ID:', error);
      return null;
    }
  }

  /**
   * Toggles the paused state of a specific job
   * @param id - Job ID to toggle pause state
   * @returns 'OK' if paused, null if unpaused or error
   */
  async togglePauseJobById(id: string): Promise<string | null> {
    try {
      const foundJob = await this.db.get(`${id}`);
      if(!foundJob) return null;
      const jobData = JSON.parse(foundJob);
      if(!['waiting','delayed'].includes(jobData.status)) {
      throw new Error(`Job ${id} is not in waiting or delayed status`);
    }
    if(jobData.paused) {
      jobData.paused = false;
    } else {
      jobData.paused = true;
      }
      await this.db.set(`${id}`, JSON.stringify(jobData));
      return jobData.paused ? 'OK' : null;
    } catch (error) {
      console.error('Error toggling job pause state:', error);
      return null;
    }
  }

  /**
   * Deletes a job by its ID
   * @param id - Job ID to delete
   * @returns 'OK' if deleted, null otherwise
   */
  async deleteJobById(id: string): Promise<string | null> {
    const deletedJob = await this.db.del(`${id}`);
    try {
      if(deletedJob) {
        await this.db.del(`${id}-stream`);
      }
      return deletedJob ? 'OK' : null;
    } catch (error) {
      console.error('Error deleting job:', error);
      return null;
    }
  }

  /**
   * Deletes all jobs in a queue with a specific status
   * @param queueStatus - String in format "queueName:status"
   * @returns 'OK' if deleted, null if error
   */
  async deleteAllJobs(queueStatus: string): Promise<string | null> {
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

  /**
   * Trims the job lists to keep them at a manageable size
   * Keeps only the most recent jobs (default 200 per status)
   * @param maxJobsPerStatus The maximum number of jobs to keep per status category
   */
  async trimJobs(maxJobsPerStatus: number = this.maxJobsPerStatus): Promise<void> {
    try {
      // Get all jobs
      const foundJobs = await this.getJobs();
      const jobs = foundJobs.filter((job: any) => job.state?.path);
      
      // Group by queue and status
      const jobsByQueueAndStatus = jobs.reduce((acc: any, job: any) => {
        const queueName = job.state?.path?.split('/')[0];
        const status = job.status.toLowerCase();
        
        if (!acc[queueName]) {
          acc[queueName] = {
            waiting: [],
            processing: [],
            failed: [],
            completed: [],
            delayed: []
          };
        }
        
        if (acc[queueName][status]) {
          acc[queueName][status].push(job);
        }
        
        return acc;
      }, {});
      
      // Process each queue and status
      for (const queueName of Object.keys(jobsByQueueAndStatus)) {
        for (const status of Object.keys(jobsByQueueAndStatus[queueName])) {
          const statusJobs = jobsByQueueAndStatus[queueName][status];
          
          // If we have more than the limit, trim the oldest ones
          if (statusJobs.length > maxJobsPerStatus) {
            // Sort by addedAt timestamp (most recent first)
            statusJobs.sort((a: any, b: any) => (b.addedAt || b.timestamp) - (a.addedAt || a.timestamp));
            
            // Keep only the newest maxJobsPerStatus jobs
            const jobsToDelete = statusJobs.slice(maxJobsPerStatus);
            
            // console.log(`Trimming ${jobsToDelete.length} ${status} jobs from queue ${queueName}`);
            
            // Delete the oldest jobs from the database
            for (const job of jobsToDelete) {
              try {
                await this.db.del(job.id);
                
                // Also clean up any associated stream entries
                if (job.messageId) {
                  await this.streamdb.xdel(`${queueName}-stream`, job.messageId);
                }
              } catch (error) {
                console.error(`Error deleting job ${job.id}:`, error);
              }
            }
          }
        }
      }
      
      // console.log('Job trimming completed');
    } catch (error) {
      // console.error('Error trimming jobs:', error);
    }
  }
}