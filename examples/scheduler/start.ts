import type { Job } from '@core/types/index.ts';
import type { AppContext } from '../index.ts';

const job: Job<AppContext> = {
  path: 'scheduler/start',
  handler: async (job, ctx) => {
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
        // id: `scheduler`
      });
    }

    // await job.logger('Hello World from scheduler-queue');
    // await job.logger('Hello World from scheduler-queue 2');
    // await job.logger('Hello World from scheduler-queue 3');
    // await job.logger('Hello World from scheduler-queue 4');
    // await job.logger('Hello World from scheduler-queue 5');
    // await job.logger('Hello World from scheduler-queue 6');
    // await job.logger('Hello World from scheduler-queue 7');

    // throw new Error('this is a big error')
    
  },
  options: {
    repeat: {
      pattern: '*/30 * * * * *',
    },
    attempts: 3,
  },
};

export default job;