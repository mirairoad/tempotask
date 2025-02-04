export default {
    path: 'scheduler/start',
    run: (ctx: unknown, job: unknown) => {
        console.log("Start from scheduler-queue");
    },
    options: {
        repeat: {
            pattern: "* * * * *",
        }
    }
}