import { ExtJobData, JobOptions } from '../../src/types/index.ts';

export default {
  path: 'scheduler/start',
  handler: async (job: ExtJobData, ctx: any) => {
    console.log(
      '%c- runs every 30 seconds',
      'color: white; background-color: yellow;',
    );
    
    for (let i = 0; i < 10; i++) {
      ctx.addJob('scheduler/onrequest', {
        name: 'John Wick',
        email: 'john.wick@example.com'
      }, {
        id: `scheduler-${i}`
      });
    }
    // await job.logger('Hello World from scheduler-queue');
    // throw new Error('this is a big error')

    // await job.logger('Hello World from scheduler-queue');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 2');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 3');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 4');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 5');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 6');
    // await new Promise((resolve) => setTimeout(resolve, 100));
    // await job.logger('Hello World from scheduler-queue 7');
    
  },
  options: {
    repeat: {
      pattern: '*/30 * * * * *',
    },
    attempts: 3,
  },
};
