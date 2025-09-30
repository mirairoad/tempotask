# TempoTask
[DASHBOARD IS IN ALPHA AND MIGRATING TO VUE SPA]

A powerful, Redis-backed job queue and task scheduling system for Deno.

## Installation

You can add TempoTask to your Deno project using JSR:

```bash
deno add jsr:@leotermine/tempotask
```

## Usage

Import the package in your Deno application:

```typescript
// Import using JSR
import * as tempotask from "@leotermine/tempotask";

// Or import directly with the JSR URL
import * as tempotask from "jsr:@leotermine/tempotask";
```

## Features

- Redis-backed persistent job queue
- Scheduled and delayed job execution
- Job retry with configurable backoff
- Real-time job status monitoring
- Dashboard UI for job management
- Distributed worker system
- Cron-style recurring jobs

## Examples

You can find complete working examples in the
[examples directory](https://github.com/leotermine/tempotask/tree/main/examples)
of the repository. Each example demonstrates different features of TempoTask:

- **[Basic Queue](https://github.com/leotermine/tempotask/tree/main/examples/basic-queue)**:
  Simple job creation and processing
- **[Scheduled Jobs](https://github.com/leotermine/tempotask/tree/main/examples/scheduled-jobs)**:
  Delayed and recurring jobs
- **[Job Retries](https://github.com/leotermine/tempotask/tree/main/examples/job-retries)**:
  Error handling and automatic retries
- **[Dashboard](https://github.com/leotermine/tempotask/tree/main/examples/dashboard)**:
  Setting up the web UI

For more detailed documentation and tutorials, check out the
[core documentation](https://github.com/leotermine/tempotask/tree/main/core/README.md).

## Running the Examples

To run any of the examples directly:

```bash
# Clone the repository
git clone https://github.com/leotermine/tempotask.git
cd tempotask

# Run a specific example
deno run -A examples/basic-queue/index.ts
```

## Documentation

For complete documentation, visit
[the official documentation site](https://tempotask.deno.dev).

Additional resources:

- [API Reference](https://tempotask.deno.dev/api)
- [Configuration Guide](https://tempotask.deno.dev/configuration)
- [Troubleshooting](https://tempotask.deno.dev/troubleshooting)

## License

MIT
