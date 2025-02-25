export default {
  path: 'scheduler/onrequest',
  handler: (ctx: unknown, job: unknown) => {
    console.log(
      '%c- runs one time',
      'color: white; background-color: green;',
    );    // throw new Error('Hello World from scheduler-queue');
  },
};
