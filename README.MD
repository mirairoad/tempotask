# Redis-MQ

A lightweight message queue system built on Redis, supporting cron jobs and one-off tasks.

## Installation

### Deno (Native JSR Support)
```typescript
import { QueueManager } from "jsr:@leotermine/redismq@0.1.0";
```

### Node.js (via JSR's npm compatibility layer)
First, create or update your `.npmrc` file:
```
@jsr:registry=https://npm.jsr.io
```

Then install:
```bash
# Using npm
npm install @leotermine/redismq

# Using yarn
yarn add @leotermine/redismq

# Using pnpm (recommended for best dependency resolution)
pnpm add @leotermine/redismq
```

## Quick Start

```typescript
import { QueueManager } from "@leotermine/redismq";
import { Redis } from "ioredis";

// 1. Configure Redis
const redisConfig = {
  port: 6379,
  host: 'localhost', // or the host in use
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// 2. Initialize Redis client
const client = new Redis(redisConfig);

// 3. Initialize Queue Manager
const contextApp = {}; // Optional context passed to job handlers
const app = QueueManager.init(client, contextApp, 1); // Last param is concurrency

// 4. Define a job
const myJob = {
  path: 'category/job-name', // Must follow 'category/name' format
  run: (ctx, job) => {
    console.log('Job running!', job);
  },
  options: {
    repeat: {
      pattern: '* * * * *' // Cron pattern (optional)
    },
    attempts: 3 // Retry attempts (optional)
  }
};

// 5. Register job
app.registerJob(myJob);

// 6. Start processing
app.processJobs();

// 7. Add one-off job (optional)
app.addJob('category/job-name', {
  data: 'your-data'
}, {
  attempts: 3
});
```

## Job Types

### Cron Jobs
```typescript
const cronJob = {
  path: 'crons/hello-world',
  run: (ctx, job) => {
    console.log("Running on schedule");
  },
  options: {
    repeat: {
      pattern: "* * * * *" // Runs every minute
    }
  }
};
```

### One-off Jobs
```typescript
const oneOffJob = {
  path: 'tasks/send-email',
  run: (ctx, job) => {
    console.log("Running once");
  }
};
```

## API Reference

### QueueManager
- `init(redisClient, context, concurrency)`: Initialize queue manager
- `registerJob(job)`: Register a new job type
- `addJob(path, data, options)`: Add a job instance
- `processJobs()`: Start processing jobs
- `getAllJobs()`: Get all jobs in queues

### Job Options
```typescript
interface JobOptions {
  repeat?: {
    pattern: string;    // Cron pattern
  };
  attempts?: number;    // Retry attempts
  _id?: string;        // Custom job ID
  priority?: number;    // Job priority
  delayUntil?: Date;   // Delay execution
}
```

## Coming Soon: Dashboard UI 🚀

A web-based dashboard is under development that will provide:
- Real-time queue monitoring
- Job status tracking and management
- Performance metrics and analytics
- Failed job inspection and retry capabilities
- Cron job schedule management
- Queue pause/resume controls

Stay tuned for this powerful addition to Redis-MQ!

## Runtime Support

- ✅ **Deno**: Native support via JSR
- ✅ **Node.js**: Full support via JSR's npm compatibility layer
- ✅ **Bun**: Compatible through Node.js compatibility
- ✅ **Cloudflare Workers**: Compatible through Node.js compatibility
- ✅ **Edge Functions**: Compatible through Node.js compatibility

## Areas for Potential Improvement

🔹 **Performance Optimization**
Instead of polling every 3s (pollIntervalMs), consider using Redis Streams (XADD, XREADGROUP) or Pub/Sub for real-time job notifications, reducing unnecessary queries.
Jobs are fetched using SCAN in #processJobsLoop(). While better than KEYS, sorted sets (ZSET) with timestamps might be more efficient.

🔹 **Observability & Monitoring**
Adding metrics collection (e.g., job success/failure rates, queue length).
Implementing structured logging (e.g., using pino or winston for logs).

🔹 **Backpressure Handling**
If jobs arrive faster than they are processed, it could implement rate limiting or job deduplication before adding to the queue.

## License

MIT
