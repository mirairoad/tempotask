export default {
    path: 'crons/hello-world',
    run: (ctx: unknown, job: unknown) => {
        console.log("Hello World from cron-queue");
        // throw new Error("Hello World from cron-queue");
    },
    options: {
        repeat: {
            pattern: "* * * * *",
        },
        // attempts: 3,
    }
}