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

// ... existing code ...

## Quick Start

```typescript
import { QueueManager } from '@leotermine/tempotask';
import type { Task } from '@leotermine/tempotask/types';
import { Redis, type RedisOptions } from 'ioredis';

// Create Redis connection
const redisOption = {
  port: 6379,
  host: 'localhost',
  db: 0,
  optimise: true, // This will offload the Redis connection to a different database example(db_0 and duplicate on db_1 and assign to the stream)
} as RedisOptions;

const db = new Redis(redisOption);

// Define your application context (optional)
const appContext = {
  mongodb: {
    create: () => Promise.resolve(console.log('create')),
    read: () => Promise.resolve(console.log('read')),
    update: () => Promise.resolve(console.log('update')),
    delete: () => Promise.resolve(console.log('delete')),
  },
};

// Initialize queue manager with context and configuration
const tempotask = QueueManager.init({
  db,
  ctx: appContext,
  concurrency: 1,
  options: {
    maxJobsPerStatus: 300,
  },
});

// Define data structure for your job
type UserData = {
  id: number;
  name: string;
  email: string;
};

// Define a cron job using the Task interface
const cronJob: Task<UserData> = {
  name: 'process-users',
  queue: 'crons',
  description: 'Process users every 5 minutes',
  handler: async (job, ctx) => {
    console.log('Running scheduled task:', job.name);
    
    // Access typed job data
    const userData = job.data;
    console.log('Processing user:', userData?.name);
    
    // Create child jobs using the context
    ctx.addJob({
      name: 'send-email',
      queue: 'notifications',
      data: { userId: userData?.id, email: userData?.email },
      options: {
        id: `email-${userData?.id}`,
        attempts: 3,
      },
    });
    
    // Use job logger
    await job.logger('User processing completed');
  },
  options: {
    repeat: {
      pattern: '*/5 * * * *', // Every 5 minutes
    },
    attempts: 3, // Retry 3 times on failure
  },
};

// Define a one-off task
const oneOffTask: Task<unknown> = {
  name: 'send-notification',
  queue: 'notifications',
  description: 'Send notification to user',
  handler: async (job, ctx) => {
    console.log('Running one-off task:', job.data);
    await job.logger('Notification sent successfully');
  },
  options: {
    attempts: 3,
  },
};

// Register jobs
tempotask.registerJob(cronJob);
tempotask.registerJob(oneOffTask);

// Start processing jobs
tempotask.processJobs();

// Add a one-off task on demand
tempotask.addJob({
  name: 'send-notification',
  queue: 'notifications',
  data: {
    message: 'Hello World',
    userId: 123,
  },
  options: {
    id: 'notification-123',
    attempts: 3,
  },
});
```

// ... existing code ...

## Job Types

```typescript
import type { Task, ExtJobData, defaultContext } from '@leotermine/tempotask/types';

// Define your data structure
type MyDataType = {
  id: number;
  message: string;
};

// Define your custom context (extends defaultContext)
interface MyAppContext extends defaultContext {
  database: {
    save: (data: any) => Promise<void>;
    find: (id: number) => Promise<any>;
  };
  externalApi: {
    send: (data: any) => Promise<void>;
  };
}

// Task Definition
const myTask: Task<MyDataType, MyAppContext> = {
  name: 'process-data',
  queue: 'main',
  description: 'Process incoming data',
  handler: async (job, ctx) => {
    // job.data is typed as MyDataType
    const data = job.data;
    console.log('Processing:', data?.message);
    
    // ctx has your custom context + defaultContext (addJob method)
    await ctx.database.save(data);
    await ctx.externalApi.send(data);
    
    // Create child jobs
    ctx.addJob({
      name: 'cleanup',
      queue: 'main',
      data: { id: data?.id },
      options: {
        delayUntil: new Date(Date.now() + 60000), // Delay 1 minute
      },
    });
    
    // Log progress
    await job.logger('Data processing completed');
  },
  options: {
    attempts: 5,
    retryDelayMs: 5000,
    repeat: {
      pattern: '0 */1 * * *', // Every hour
    },
  },
};

// ExtJobData provides access to job information and utilities
interface ExtJobData<T> {
  name: string;
  queue: string;
  data?: T; // Typed data based on your Task definition
  logger: (message: string | object) => Promise<void>;
  // Other job properties...
}
```

// ... existing code ...

## Error Handling & Job Recovery

TempoTask includes robust error handling mechanisms:

```typescript
import type { Task } from '@leotermine/tempotask/types';

// Define a job with comprehensive error handling
const robustJob: Task<unknown> = {
  name: 'risky-operation',
  queue: 'critical',
  description: 'Perform risky operation with retry logic',
  handler: async (job, ctx) => {
    try {
      // Your risky task logic here
      await riskyOperation();
      await job.logger('Operation completed successfully');
    } catch (error) {
      // Log error for dashboard visibility
      await job.logger(`Error occurred: ${error.message}`);
      
      // You can create fallback jobs
      ctx.addJob({
        name: 'fallback-operation',
        queue: 'critical',
        data: { originalError: error.message },
        options: {
          attempts: 1,
          priority: 10, // High priority
        },
      });
      
      // Rethrow to trigger retry mechanism
      throw error;
    }
  },
  options: {
    attempts: 5, // Retry 5 times
    retryDelayMs: 10000, // Wait 10 seconds between retries
    priority: 5, // Normal priority
  },
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
  host: 'localhost',
  db: 0,
  optimise: true, // Enables performance optimization which duplicate the db + 1 and assign a different db to the stream for maximum performance.
};

const db = new Redis(redisOption);
const tempotask = QueueManager.init(db, {}, cpuCount, {
  maxJobsPerStatus: 300,
});
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
