import { JobHandler, ExtJobData } from '../../src/types/index.ts';

export default {
  path: 'scheduler/onrequest',
  handler: async (job: ExtJobData, ctx: unknown) => {
    console.log(
      '%c- runs one time',
      'color: white; background-color: green;',
    );
    // throw new Error('Hello World from scheduler-queue');
    // await job.logger('Hello World from scheduler-queue');
    // await job.logger('Hello World from scheduler-queue 2');
  },
  options: {
    attempts: 3,
  }
};
