# Database

**Cloudflare D1**, accessed through **Drizzle ORM's D1 adapter**. Only `@ak5/api`
has the `DB` binding. Web, admin, CLI and native mobile use its API. No database
connection string or runtime database API token is needed.

## Schema

`packages/api/src/db/schema.ts` defines the SQLite schema. Identity tables are
`users`, `admin_users`, `auth_email`, and the removable `auth_discord` provider.
`tokens` stores expiring, hashed secrets with exactly one user/admin owner.
`api_keys`, `sessions`, `logs`, `config`, and `audit_log` support platform operations.
`items` is a replaceable per-user CRUD example.

Internal nanoid keys are for joins; APIs only expose prefixed public IDs. JSON
values use Drizzle's JSON text mode. Dates use integer milliseconds and map to
JavaScript `Date` objects; booleans use integer boolean mode. Enums have TypeScript
unions and database CHECK constraints. Partial unique indexes allow reuse of
usernames/emails after soft deletion. Foreign keys remain enabled.

## Atomic writes

D1 does not support interactive Drizzle transaction callbacks. Use `db.batch`
with unexecuted query builders for related writes. A failing statement rolls
back the batch. Compute password hashes and token hashes before execution;
never await a query builder before adding it to the batch.

Account creation, credentials, invitation tokens and invitation audits commit
together before sending email. Delivery failure leaves a retryable account and
committed audit evidence. Token consumption uses one `DELETE ... RETURNING`
statement with a limited subquery, so simultaneous requests cannot reuse a token.

## Migrations and environments

Committed SQL migrations live in `packages/api/drizzle`. Edit the schema, run
`pnpm db:generate`, review the generated SQL, and commit both schema and migration.
Use `pnpm db:migrate` for **local** Wrangler storage. Repeating it is safe; Wrangler
tracks applied migrations. Do not use schema push to provision deployments.

Each consuming app creates its own D1 databases. Staging and production must use
different IDs. Trusted PR previews share staging's binding and do not migrate it;
schema-dependent previews need the additive migration staged first. Deployments
apply migrations to the selected environment before deploying the API.

Use additive migrations while deployed code may still use a column. Drop or
rename columns in phases: add and populate, switch callers, then remove in a
later release. Back up the target database and review destructive SQL separately.
D1 has per-database storage and per-query limits; index filters and monitor rows
read/written. See [deployment](../operations/deployment.md) and
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Tests

`pnpm test:db` creates disposable, non-persistent local D1 bindings, applies the
committed SQL and exercises constraints, rollback, JSON/date mapping, token races,
email failure and item ownership. It never connects to an account or a deployed
database. Playwright uses the local stack's persistent D1; use an isolated checkout
for a completely disposable browser-test database.

## LiveStore event log

Local-first notes persist events to this D1 database through a per-store Durable
Object. LiveStore owns its `eventlog_*` tables; Drizzle owns the identity and
online item tables. See [local-first notes](local-first.md) for ordering, client
materialization, and account data retention.
