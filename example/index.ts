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
};

const client = new Redis(redisOption) as unknown as RedisConnection;
// create a new redis connection for the streamdb this enchance performance drastically on the dashboard
const streamdb = new Redis({...redisOption, db: 1}) as unknown as RedisConnection;



const contextApp = {}; // this can be anything like a server instance / store / even a mongowrapper to do calls to db

const jqm = QueueManager.init(client, contextApp, cpuCount, streamdb);

// register jobs
jqm.registerJob(helloWorld); // cron
jqm.registerJob(multiJobs); // cron
jqm.registerJob(startScheduler); // cron
jqm.registerJob(onRequest); // no cron

jqm.addJob('scheduler/onrequest', {
  name: 'John Doe',
  email: 'john.doe@example.com'
}, {
  attempts: 3,
});

jqm.processJobs();

export { jqm }
