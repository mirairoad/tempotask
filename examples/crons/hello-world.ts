import type { Task } from '@core/types/index.ts';

const task: Task<unknown> = {
  name: 'hello-world',
  queue: 'crons',
  handler: (ctx, job: unknown) => {
    console.log(
      '%c- runs every 1 minutes',
      'color: white; background-color: red;',
    );
    setTimeout(() => {
    }, 5000);
  },
  options: {
    repeat: {
      pattern: '* * * * *',
    },
    retryCount: 3,
    retryDelayMs: 15000,
    delayUntil: new Date(Date.now() + 6000000),
  },
};

export default task;
