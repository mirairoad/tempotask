export default {
  path: 'scheduler/start',
  handler: (ctx: unknown, job: unknown) => {
    console.log(
      '%c- runs every 15 seconds',
      'color: white; background-color: yellow;',
    );
    setTimeout(() => {
    }, 2000);
  },
  options: {
    repeat: {
      pattern: '*/15 * * * * *',
    },
  },
};
