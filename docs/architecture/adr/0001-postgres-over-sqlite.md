# ADR 0001 — Postgres over edge SQLite/KV

**Status:** Accepted

## Context

The API runs on Cloudflare Workers. The Workers ecosystem offers tempting
co-located data stores — D1 (edge SQLite), KV, and Durable Objects — that live
inside the runtime and need no external connection. They are fast for simple
reads, but the data model here is relational from day one: identity tables that
reference each other, a tokens table with a cross-table integrity constraint, an
audit log, and a config table. We want real foreign keys, transactional
migrations, a typed query builder, and the ability to spin up a throwaway copy
of the schema per test run.

## Decision

Use **Neon serverless Postgres** accessed through **Drizzle ORM**. A single
`@ak5/api` worker owns all database access — no other worker holds
`DATABASE_URL` or talks to the database directly. Drizzle owns the schema in
`packages/api/src/db/schema.ts`, generates SQL migrations, and gives the API a
fully typed query layer. Tests run against a branched copy of the database
(branch-per-test-run), wiped and migrated in global setup.

## Consequences

- Real relational integrity: foreign keys, `CHECK` constraints (e.g. the
  exclusive-arc tokens check), and transactions are available and enforced.
- Migrations are versioned SQL artifacts, reviewable in PRs and replayable in
  prod.
- Neon's branching gives each test run an isolated, disposable database for a few
  cents, so suites never share state.
- Cost: a network hop to Neon on every query, and a connection-pooling story
  (Neon's serverless driver over HTTP/WebSocket) that edge-local stores would
  avoid. Acceptable for an auth/identity workload that is not read-hot.
- The "API owns the DB" rule is load-bearing for the least-privilege secret split
  (ADR 0003): only one worker can reach the data.

## Alternatives considered

- **D1 (edge SQLite):** lowest latency and no external dependency, but weaker
  relational tooling at the time, no first-class branching for tests, and a
  migration story we did not want to bet the data model on.
- **KV / Durable Objects:** key-value and actor models, not relational. Modeling
  joins and integrity constraints by hand would reinvent a database badly.
- **Postgres on a traditional host:** works, but loses serverless scale-to-zero
  and the cheap test-branch workflow that Neon provides.
