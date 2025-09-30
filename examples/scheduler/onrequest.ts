import type { Task } from '@core/types/index.ts';

const task: Task<unknown> = {
  name: 'onrequest',
  queue: 'crons',
  handler: async (job, ctx) => {
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    console.log(job.data)
    await job.logger('testing the logger');
    // randomly throw an error
    if (Math.random() > 0.5) {
      throw new Error('random error');
    }
  },
  options: {
    attempts: 3,
  },
};

export default task;
