import { QueueManager } from '../src/mod.ts';
import { Redis, RedisOptions } from 'ioredis';

// import crons
import helloWorld from './crons/hello-world.ts';
import startScheduler from './scheduler/start.ts';
import multiJobs from './crons/multi-jobs.ts';
import onRequest from './scheduler/onrequest.ts';
import { RedisConnection } from '../src/types/index.ts';

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
};

// create a streamdb this enchance performance drastically and they gets unaffected by the dashboard
const db = new Redis(redisOption) as unknown as RedisConnection;
// this can be anything like a server instance / store / even a mongowrapper to do calls to the db
const contextApp = {}; 
// initialize the queue manager
const jqm = QueueManager.init(db, contextApp, cpuCount);

// register jobs
jqm.registerJob(helloWorld); // cron
jqm.registerJob(multiJobs); // cron
jqm.registerJob(startScheduler); // cron
jqm.registerJob(onRequest); // no cron

// process jobs
jqm.processJobs();

export { jqm }
