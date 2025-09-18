import type { Task } from '@core/types/index.ts';

type DataStructure = {
  users: {
    name: string;
    email: string;
  }[];
};

const task: Task<DataStructure> = {
  name: 'start',
  queue: 'crons',
  handler: async (job, ctx) => {
    console.log(
      '%c- runs every 30 seconds',
      'color: white; background-color: yellow;',
    );

    const users = [
      {
        id: 1,
        name: 'John Wick',
        email: 'john.wick@example.com',
      },
      {
        id: 2,
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
      },
      {
        id: 3,
        name: 'Jim Beam',
        email: 'jim.beam@example.com',
      },
    ];
    // for (let i = 0; i < 3; i++) {
    //   ctx.addJob('scheduler/onrequest', users[i], {
    //     id: `onrequest-${i}`,
    //   });
    //   await job.logger(`added job onrequest-${i}`);
    // }
  },
  options: {
    repeat: {
      pattern: '*/30 * * * * *',
    },
    attempts: 3,
  },
};

export default task;
