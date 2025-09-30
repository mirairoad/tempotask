import { QueueManager } from '@core/mod.ts';
import { Redis } from 'ioredis';

// import crons
import helloWorld from './crons/hello-world.ts';
import startScheduler from './scheduler/start.ts';
import multiJobs from './crons/multi-jobs.ts';
import onRequest from './scheduler/onrequest.ts';

// Create Redis Option
const redisOption = {
  port: 6379,
  host: 'localhost',
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: 1, //this will be assigne to 1 and stream will be assigne to 2, if you select 4 then it will be assigne to 4 and stream will be assigne to 5
};

// create a streamdb this enchance performance drastically and they gets unaffected by the dashboard
const db = new Redis(redisOption);

// define the context for the app SAMPLE you pass your own context to the tasker so it will be always available, otherwise it will be undefined
const contextApp = {
  mongodb: {
    create: () => Promise.resolve(console.log('create')),
    read: () => Promise.resolve(console.log('read')),
    update: () => Promise.resolve(console.log('update')),
    delete: () => Promise.resolve(console.log('delete')),
  },
};
contextApp
// initialize the queue manager
const tempotask = QueueManager.init({
  db,
  ctx: contextApp,
  concurrency: 1,
  options: {
    maxJobsPerStatus: 10,
  },
});

// register jobs
tempotask.registerJob(helloWorld); // cron
tempotask.registerJob(multiJobs);  
tempotask.registerJob(startScheduler); // cron
tempotask.registerJob(onRequest); // no cron

// process jobs
const queuesCount = tempotask.getQueuesList().length;
const jobsCount = tempotask.getJobsList().length;

console.log(`🚚 tempotask is running: ${queuesCount} queues, ${jobsCount} jobs`);


tempotask.processJobs();



tempotask.addJob({
  name: 'onrequest',
  queue: 'crons',
  data: {
    message: 'hello world',
  },
  options: {
    id: 'onrequest-1',
  },
})


// tempotask.shutdown();

