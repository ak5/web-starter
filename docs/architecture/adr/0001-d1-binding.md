# ADR 0001 — Cloudflare D1 through a Worker binding

**Status:** Accepted

## Decision

The API owns a native `DB: D1Database` binding and queries it with Drizzle's D1
adapter and SQLite schema. Web, admin, and mobile use the typed API and never
receive database credentials. Development uses local Wrangler persistence.

## Consequences

- Compute and SQL storage share the Cloudflare account and billing model.
- Development, optional stable staging and production have separate databases;
  trusted PR previews share development.
- SQLite foreign keys, partial unique indexes and CHECK constraints enforce integrity.
- Related writes use atomic D1 batches. Do not replace them with sequential writes
  or interactive transaction callbacks, which the D1 binding does not support.
- Migrations are committed SQL and run before the API deploys. Local CI needs no
  provider account. D1 row, storage, query and execution limits shape capacity;
  measure queries and index access paths before scaling.
- The binding is server-side storage. [LiveStore notes](../local-first.md)
  synchronize local web/native SQLite through a D1 event log and Durable Object.
