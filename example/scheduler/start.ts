import { ExtJobData } from '../../src/types/index.ts';

export default {
  path: 'scheduler/start',
  handler: async (job: ExtJobData, ctx: unknown) => {
    console.log(
      '%c- runs every 15 seconds',
      'color: white; background-color: yellow;',
    );
    // await job.logger('Hello World from scheduler-queue');
    // throw new Error('this is a big error')

    // await job.logger('Hello World from scheduler-queue');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 2');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 3');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 4');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 5');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 6');
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // await job.logger('Hello World from scheduler-queue 7');
    
  },
  options: {
    repeat: {
      pattern: '*/15 * * * * *',
    },
    attempts: 3,
  },
};
