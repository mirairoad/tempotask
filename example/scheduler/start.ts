export default {
  path: 'scheduler/start',
  run: (ctx: unknown, job: unknown) => {
    console.log(
      '%c- running start.ts from scheduler-queue',
      'color: white; background-color: yellow;',
    );
  },
  options: {
    repeat: {
      pattern: '*/10 * * * * *',
    },
  },
};
