import { QueueManager } from "@core/mod.ts";
import { Redis, type RedisOptions } from 'ioredis';

// import crons
import helloWorld from './crons/hello-world.ts';
import startScheduler from './scheduler/start.ts';
import multiJobs from './crons/multi-jobs.ts';
import onRequest from './scheduler/onrequest.ts';
import type { RedisConnection } from '@core/types/index.ts';

const cpuCount = 1;

// Create Redis Option
const redisOption = {
  port: 6379,
  host: 'localhost',
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: 0,
  // this will offload the redis connection to a different database CUSTOM OPTIONS below
  optimise: true, 
} as RedisOptions;

// create a streamdb this enchance performance drastically and they gets unaffected by the dashboard
const db = new Redis(redisOption) as unknown as RedisConnection;
// this can be anything like a server instance / store / even a mongowrapper to do calls to the db

// define the context for the app SAMPLE you pass your own context to the job
export interface AppContext {
  mongodb: {
    create: () => Promise<void>;
    read: () => Promise<void>;
    update: () => Promise<void>;
    delete: () => Promise<void>;
  };
}

// initialize the context for the app SAMPLE you pass your own context to the job
const contextApp: AppContext = {
  mongodb: {
    create: () => Promise.resolve(console.log('create')),
    read: () => Promise.resolve(console.log('read')),
    update: () => Promise.resolve(console.log('update')),
    delete: () => Promise.resolve(console.log('delete')),
  },
}; 

// initialize the queue manager
const tempotask = QueueManager.init(db, contextApp, cpuCount, { maxJobsPerStatus: 300 });

// register jobs
tempotask.registerJob(helloWorld); // cron
tempotask.registerJob(multiJobs); // cron
tempotask.registerJob(startScheduler); // cron
tempotask.registerJob(onRequest); // no cron

// process jobs
tempotask.processJobs();
export { tempotask }
