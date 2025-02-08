# Redis-MQ

A lightweight, non-blocking job queue system inspired by BullMQ, built on Redis Streams. Specializes in both cron jobs and one-off tasks with decoupled architecture for maximum flexibility and performance.

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
- **Event System**: Track job completion and failures

## Quick Start

```typescript
import { QueueManager } from '@leotermine/redismq';
import { Redis } from 'ioredis';

// Initialize Redis and Queue Manager
const client = new Redis();
const app = QueueManager.init(client, {}, 5); // 5 concurrent jobs

// Define a cron job
const cronJob = {
  path: 'tasks/recurring',
  run: async (ctx, job) => {
    console.log('Running scheduled task:', job.id);
  },
  options: {
    repeat: {
      pattern: '*/5 * * * *', // Every 5 minutes
    }
  }
};

// Define a one-off task
const oneOffTask = {
  path: 'tasks/single',
  run: async (ctx, job) => {
    console.log('Running one-off task:', job.id);
  }
};

// Register jobs
app.registerJob(cronJob);
app.registerJob(oneOffTask);

// Start processing in non-blocking way
app.processJobs();

// Add a one-off task on demand
await app.addJob('tasks/single', { 
  data: 'some data'
});
```

## Worker Management

```typescript
// Create independent workers
const worker = queue.createWorker(handler, {
  concurrency: 5,
  pollIntervalMs: 1000,
});

// Non-blocking event handling
worker.addEventListener('complete', (event) => {
  console.log('Job completed:', event.detail);
});
```

## Job Types

```typescript
// Cron Job Definition
interface CronJob {
  path: string;
  run: (ctx: any, job: any) => Promise<void>;
  options: {
    repeat: {
      pattern: string; // Cron pattern
    };
  };
}

// One-off Task Definition
interface Task {
  path: string;
  run: (ctx: any, job: any) => Promise<void>;
}
```

## Why Redis-MQ?

- **Non-blocking**: Fully asynchronous operations
- **Flexible**: Supports both cron and one-off tasks
- **Decoupled**: Independent producers and consumers
- **Scalable**: Easy horizontal scaling
- **Modern**: Full TypeScript support
- **Lightweight**: Minimal dependencies

## Runtime Support

- ✅ **Deno**: Native support via JSR
- ✅ **Node.js**: Full support via JSR's npm compatibility layer
- ✅ **Bun**: Compatible through Node.js compatibility
- ✅ **Cloudflare Workers**: Compatible through Node.js compatibility
- ✅ **Edge Functions**: Compatible through Node.js compatibility

## Coming Soon
- 📊 Real-time monitoring dashboard
- 📈 Performance metrics and analytics
- 🔍 Dead letter queue management
- 🔄 Advanced retry strategies
- 🎯 Job prioritization improvements
- ⏰ Delayed job execution
- 🔁 Job retry mechanisms

## License

MIT
