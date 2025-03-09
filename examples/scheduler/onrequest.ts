import type { Task } from '@core/types/index.ts';

const task: Task<unknown, unknown> = {
  path: 'scheduler/onrequest',
  handler: async (job, ctx) => {
    console.log(
      '%c- runs on request',
      'color: white; background-color: green;',
    );
    await job.logger('found 10 jobs');
    await job.logger('use');
    
  },
  options: {
    attempts: 3,
  },
};

export default task;