import type { Task } from '@core/types/index.ts';

const task: Task<unknown> = {
  name: 'multi-jobs',
  queue: 'crons',
  handler: (job, ctx) => {
    console.log(
      '%c- runs every minute',
      'color: white; background-color: blue;',
    );
    setTimeout(() => {
    }, 5000);
  },
  options: {
    repeat: {
      pattern: '* * * * *',
    },
    // delayUntil: new Date(Date.now() + 60000),
    // retryCount: 3,
    // retryDelayMs: 5000,
  },
};

export default task;
