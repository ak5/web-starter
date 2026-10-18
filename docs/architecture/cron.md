# Cron

The starter ships the **mechanism** for scheduled work; it doesn't ship any
business job. This doc describes the pattern so you can add one.

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
  const db = makeDb(env.DATABASE_URL);
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
4. Guard it with a lock (below). Document the job in this file.

## Idempotency & locking

Cron jobs must be **safe to run twice** — Cloudflare can double-invoke during
deploys, and an operator may trigger a run manually. Two defenses:

- **KV locks.** Acquire a short-TTL KV key (`lock:<job>`) at the top of the job;
  bail if it's already held. The TTL auto-releases the lock if the worker dies
  mid-run, so a crash can't wedge the job permanently.
- **Idempotent writes.** Design the work so a partial or repeated run converges
  to the same state — upserts keyed by a stable id, "process rows where status =
  pending" rather than "process the next N", etc.

Keep jobs short and chunked: Workers have wall-clock limits, so prefer many small
idempotent passes over one long sweep.
