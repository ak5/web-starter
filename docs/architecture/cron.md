# Cron

The starter purges expired one-time auth tokens and rate-limit counters on every
scheduled tick. Both operations are idempotent indexed deletes. Add business jobs
to the same runner as needed.

## How it runs

`@ak5/api` is the only worker with a scheduled handler. Cloudflare invokes its
`scheduled(controller, env, ctx)` export on the cadence declared in
`packages/api/wrangler.jsonc`:

```jsonc
{
	"triggers": { "crons": ["*/15 * * * *", "0 3 * * *"] }
}
```

The handler builds the job dependencies (a DB connection, the KV namespace, a
logger) and dispatches to a single runner, wrapping the work in
`ctx.waitUntil(...)` so it completes after the handler returns:

```ts
async scheduled(controller, env, ctx) {
  const db = makeDb(env.DB);
  ctx.waitUntil(runAllCronJobs(controller.cron, { db, kv: env.KV, logger }));
}
```

`controller.cron` is the matched cron expression, so one handler can fan out to
different jobs by schedule.

## Adding a job

1. Add (or reuse) a cron expression in `wrangler.jsonc` → `triggers.crons`.
2. Write the job as a function taking the shared deps `{ db, kv, logger }`.
3. Dispatch it from the runner — branch on `cron` if it should only run on a
   specific schedule.
4. Make concurrent and repeated runs safe (below). Document the job in this file.

## Idempotency & locking

Cron jobs must be **safe to run twice**, including concurrently. Use atomic writes
and stable operation IDs so a retry converges on the same result. A read followed
by a KV write is not a lock: [KV is eventually consistent](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
and two runners can both enter. If a job needs exclusive ownership, use an atomic
D1 claim or a Durable Object, and make its external side effects retry-safe too.

Keep jobs short and chunked: Workers have execution limits, so prefer many small
idempotent passes over one long sweep.
