export default {
    path: 'crons/multi-jobs',
    run: (ctx: unknown, job: unknown) => {
        console.log("Multi Jobs from cron-queue");
    },
    options: {
        repeat: {
            pattern: "* * * * *",
        }
    }
}