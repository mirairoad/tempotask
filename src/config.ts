const config = {
    STREAM_NAME: 'jobs',
    CONSUMER_GROUP: 'workers',
    POLL_INTERVAL_MS: 1000,
    CONCURRENCY: 1,
    READ_STREAM_COUNT: 200,
    READ_STREAM_BLOCK: 5000,
    READ_STREAM_START: '>'
}

export default config;