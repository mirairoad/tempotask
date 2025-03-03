# TempoTask

A lightweight, non-blocking job queue system built on Redis Streams. Specializes in both cron jobs and one-off tasks with a decoupled architecture for maximum flexibility and performance.

## Core Design Principles

### 🎯 Non-Blocking Architecture
- Fully asynchronous job processing
- Decoupled producers and consumers
- Independent worker processes
- No inter-process locking
- Efficient resource utilization

### ⚡ Dual Job Support
- **Cron Jobs**: Schedule recurring tasks with cron patterns
- **One-off Tasks**: Execute single tasks on demand
- Mix both types in the same queue
- Independent job scheduling
- Flexible job management

### 🔄 Decoupled Components
- Separate job producers and consumers
- Independent worker processes
- Scalable architecture
- Easy horizontal scaling
- Process isolation

### 🚀 Key Features
- **Non-blocking Operations**: Asynchronous job processing
- **Cron Support**: Schedule recurring jobs with cron patterns
- **One-off Tasks**: Execute tasks on demand
- **Built-in Concurrency**: Multiple workers process jobs simultaneously
- **Stream-based**: Redis Streams for reliable message delivery
- **Error Handling**: Comprehensive error tracking and recovery
- **Job Recovery**: Automatic recovery of stalled jobs
- **Dashboard UI**: Monitor and manage jobs through web interface

## Quick Start

```typescript
import { QueueManager } from "@leotermine/tempotask";
import { Redis, type RedisOptions } from 'ioredis';

// Create Redis connection
const redisOption = {
  port: 6379,
  host: 'localhost',
  db: 0,
  optimise: true,   // This will offload the Redis connection to a different database example(db_0 and duplicate on db_1 and assign to the stream)
} as RedisOptions;

const db = new Redis(redisOption);

// Initialize queue manager with 1 or more concurrent jobs.
const tempotask = QueueManager.init(db, {}, 1, { maxJobsPerStatus: 300 });

// Define a cron job pretty much same as bullmq (missing debounce and backoff strategy)
const cronJob = {
  path: 'crons/recurring',
  handler: async (job, ctx) => {
    console.log('Running scheduled task:', job.id);
    // Use job.logger to log information
    await job.logger('Task executed successfully');
  },
  options: {
    repeat: {
      pattern: '*/5 * * * *', // Every 5 minutes
    },
    attempts: 3 // Retry 3 times on failure
  }
};

// Define a one-off task
const oneOffTask = {
  path: 'tasks/single',
  handler: async (job, ctx) => {
    console.log('Running one-off task:', job.data);
  },
  options: {
    attempts: 3
  }
};

// Register jobs
tempotask.registerJob(cronJob);
tempotask.registerJob(oneOffTask);

// Start processing jobs
tempotask.processJobs();

// Add a one-off task on demand
tempotask.addJob('tasks/single', { 
  data: 'some data',
  timestamp: new Date()
});
```


## Admin Dashboard

TempoTask includes a built-in dashboard UI for monitoring and managing your jobs:

```typescript
import { QueueManager } from "@leotermine/tempotask";
import { HonoAdaptor } from "@leotermine/tempotask/adaptors/hono.adaptor.ts";
import { Hono } from "hono";
import { Redis } from "ioredis";

// Initialize Redis and Queue Manager
const db = new Redis();
const tempotask = QueueManager.init(db);

// Create Hono server
const server = new Hono();

// Initialize dashboard
const dashboard = new HonoAdaptor(tempotask);

// Add dashboard routes to server
server.route('/', dashboard.initRouter());

// Start the server
Deno.serve({ port: 8000 }, server.fetch);
```


The dashboard provides:
- Live job status monitoring
- Job details and history
- Pause/resume functionality
- Delete jobs individually or in bulk
- View execution logs
- Inspect job data

## Job Types

```typescript
// Cron Job Definition
interface Job<Context> {
  path: string;
  handler: (job: ExtJobData, ctx: Context) => Promise<void>;
  options?: {
    repeat?: {
      pattern: string; // Cron pattern
    };
    attempts?: number; // Number of retry attempts
    id?: string; // Optional custom ID
  };
}

// ExtJobData provides access to job information and utilities
interface ExtJobData {
  id: string;
  data: unknown;
  logger: (message: string) => Promise<void>;
  // Other job properties...
}
```

## Error Handling & Job Recovery

TempoTask includes robust error handling mechanisms:

```typescript
// Define a job with retry options
const robustJob = {
  path: 'tasks/important',
  handler: async (job, ctx) => {
    try {
      // Your task logic here
      await riskyOperation();
    } catch (error) {
      // Log error for dashboard visibility
      await job.logger(`Error: ${error.message}`);
      
      // Rethrow to trigger retry mechanism
      throw error;
    }
  },
  options: {
    attempts: 5, // Retry 5 times
    retryDelayMs: 10000 // Wait 10 seconds between retries
  }
};
```

The system automatically:
- Tracks error details in job history
- Applies configured retry policies
- Recovers stalled jobs after system crashes
- Records complete error stacks for debugging

## Stream Management

TempoTask uses Redis Streams for efficient job processing, with built-in management:

```typescript
// Configure stream trimming in your job queue
const options = {
  maxJobsPerStatus: 300, // Keep up to 300 jobs per status category
};

const tempotask = QueueManager.init(db, {}, cpuCount, options);

// Automatic stream trimming happens:
// 1. After each job processing cycle
// 2. When adding new jobs to maintain optimal performance
// 3. Periodically for system maintenance
```

## Why TempoTask?

- **Non-blocking**: Fully asynchronous operations
- **Flexible**: Supports both cron and one-off tasks
- **Decoupled**: Independent producers and consumers
- **Scalable**: Easy horizontal scaling
- **Modern**: Full TypeScript support
- **Lightweight**: Minimal dependencies
- **Dashboard**: Built-in web UI for monitoring
- **Deno-first**: Optimized for Deno's runtime
- **Redis Streams**: Reliable message delivery
- **Resilient**: Automatic recovery of stalled jobs

## Job Status States

Jobs in TempoTask can have the following statuses:
- **waiting**: Job queued and waiting to be processed
- **processing**: Currently being executed
- **completed**: Successfully processed
- **failed**: Execution resulted in an error
- **delayed**: Scheduled to run at a later time

## Performance Optimization

TempoTask supports optimized Redis connections for high-throughput scenarios:

```typescript
const redisOption = {
  port: 6379,
  host: "localhost",
  db: 0,
  optimise: true, // Enables performance optimization which duplicate the db + 1 and assign a different db to the stream for maximum performance.
};

const db = new Redis(redisOption);
const tempotask = QueueManager.init(db, {}, cpuCount, { maxJobsPerStatus: 300 });
```

## Runtime Support

- ✅ **Deno**: Native support via JSR

## Coming Soon
- 📖 Documentation website
- 📈 Performance metrics and analytics
- 🔍 Dead letter queue for failed jobs
- 🔄 Advanced retry strategies with exponential backoff
- 🎯 Job prioritization improvements
- 🧹 Enhanced stream cleaning and maintenance

## License

MIT
