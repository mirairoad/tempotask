import { QueueManager } from '../src/mod.ts';
import { Redis } from 'ioredis';

// import crons
import helloWorld from './crons/hello-world.ts';
import startScheduler from './scheduler/start.ts';
import multiJobs from './crons/multi-jobs.ts';
import onRequest from './scheduler/onrequest.ts';

const cpuCount = 1;
// Create Redis Option
const redisOption = {
  port: 6379,
  host: 'localhost',
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const client = new Redis(redisOption);

const contextApp = {}; // this can be anything like a server instance / store / even a mongowrapper to do calls to db

const jqm = QueueManager.init(client, contextApp, cpuCount);

// register jobs
jqm.registerJob(helloWorld); // cron
jqm.registerJob(multiJobs); // cron
jqm.registerJob(startScheduler); // cron
jqm.registerJob(onRequest); // no cron

jqm.addJob('scheduler/onrequest', {
}, {
  attempts: 3,
});

jqm.processJobs();

export { jqm }
