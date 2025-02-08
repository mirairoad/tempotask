export default {
  path: 'crons/hello-world',
  run: (ctx: unknown, job: unknown) => {
    console.log(
      '%c- running hello-world.ts from cron-queue',
      'color: white; background-color: red;',
    );
  },
  options: {
    repeat: {
      pattern: '*/5 * * * * *', // every 2 minutes
    },
    retryCount: 3,
    retryDelayMs: 15000,
    delayUntil: new Date(Date.now() + 6000000),
  },
};
