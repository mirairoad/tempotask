export default {
  path: 'crons/hello-world',
  handler: (ctx:unknown, job: unknown) => {
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
