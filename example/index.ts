import { JobQueueManager } from "../src/mod.ts";
import { Redis } from "ioredis";

// import crons
import helloWorld from "./crons/hello-world.ts";
import startScheduler from "./scheduler/start.ts";
import multiJobs from "./crons/multi-jobs.ts";
import onRequest from "./scheduler/onrequest.ts";

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

const contextApp = {} // this can be anything like a server instance / store / even a mongowrapper to do calls to db

const app = await JobQueueManager.init(client, contextApp, 1);

// register jobs
app.registerJob(helloWorld); // cron
app.registerJob(multiJobs); // cron
app.registerJob(startScheduler); // cron
app.registerJob(onRequest); // no cron

// test
// const activeJobs = await app.getAllJobs();
// console.log(activeJobs)

// app.addJob('scheduler/onrequest', {
//   userId:['1234567890','1234567892'],
// }, {
//   _id:'2132321',
//   attempts: 3,
// });

app.processJobs();