export default {
    path: 'scheduler/onrequest',
    run: (ctx: unknown, job: unknown) => {
        console.log("run on request from scheduler-queue");
        throw new Error("Hello World from scheduler-queue");
    },
}