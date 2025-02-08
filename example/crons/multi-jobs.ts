export default {
  path: 'crons/multi-jobs',
  run: (ctx: unknown, job: unknown) => {
    console.log(
      '%c- running multi-jobs.ts from cron-queue',
      'color: white; background-color: blue;',
    );
  },
  options: {
    repeat: {
      pattern: '* * * * *', // every 45 seconds
    },
    delayUntil: new Date(Date.now() + 60000),
    retryCount: 3,
    retryDelayMs: 5000,
  },
};
