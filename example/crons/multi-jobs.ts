export default {
  path: 'crons/multi-jobs',
  handler: (ctx: unknown, job: unknown) => {
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
