# Database

**Neon Postgres**, accessed through **Drizzle ORM**. Exactly one worker —
`@ak5/api` — opens a connection (`DATABASE_URL`); no frontend has a DB binding.
The schema lives in `packages/api/src/db/schema.ts` and migrations in
`packages/api/drizzle/`.

## Platform tables

| Table           | Purpose                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `users`         | Public app identities — profile, email, role, ban/delete flags.                             |
| `admin_users`   | Admin portal identities, separate from `users`.                                             |
| `auth_email`    | Email + password credential, joined to a subject by `subject_type` + `subject_id`.          |
| `auth_provider` | OAuth login credential (removable overlay), same subject discriminator.                     |
| `api_keys`      | Long-lived machine credentials for programmatic access.                                     |
| `sessions`      | Active login sessions for listing/revocation.                                               |
| `tokens`        | Short-lived secrets (verify, reset, magic, invite); exclusive-arc on `(user_id, admin_id)`. |
| `logs`          | Structured application log sink.                                                            |
| `config`        | Singleton/keyed runtime configuration.                                                      |
| `audit_log`     | Append-only record of sensitive admin actions (bans, impersonation, invites).               |

The identity tables hold **generic** columns only: `id`, `public_id`,
`username`, `display_name`, `avatar`, `avatar_source`, `email`,
`email_verified`, `role`, `banned_at`, legal `terms`/`privacy` version +
accepted-at, `username_change_at`, `last_login_at`, `created_at`, `deleted_at`.

## Example domain table

`items` is **not** a platform table — it's a demo CRUD resource (driven by the
native mobile app) showing how to add your own. Replace or delete it.

| Column        | Notes                                            |
| ------------- | ------------------------------------------------ |
| `id`          | internal nanoid PK (joins only).                 |
| `public_id`   | `i-…`, the only id exposed to clients.           |
| `user_id`     | FK → `users.id`; every item is owned by a user.  |
| `data`        | `jsonb`, free-form — the API stores it verbatim. |
| `created_at`  | set on insert.                                   |
| `modified_at` | bumped on every update.                          |

See [api/items.md](api/items.md) for the endpoints and a checklist for removing
it cleanly (table, relation, `item` public-id prefix, routes, lib).

## Enums

| Enum            | Values (illustrative)                                           |
| --------------- | --------------------------------------------------------------- |
| `user_role`     | `user`, `admin`, … role discriminator                           |
| `token_purpose` | `verify_email`, `reset_password`, `magic_login`, `invite`       |
| `subject_type`  | `user`, `admin` — which identity table a credential attaches to |
| `log_level`     | `debug`, `info`, `warn`, `error`                                |
| `avatar_source` | `upload`, `oauth`, `gravatar`, `initials`                       |

## Internal PKs vs public IDs

Every table has an internal nanoid PK for joins **and** a prefixed `public_id`
(`u-…`, `a-…`, `t-…`). Only the public ID ever leaves the API — in JSON, URLs,
JWTs, or cookies. See [security.md](security.md).

## Migration policy

One worker owns the schema, so migrations are deliberate and **forward-safe**:

- **Additive-only, one migration per PR.** A schema PR adds exactly one
  generated migration. No editing a previously-shipped migration.
- **Column drop = 2 PRs.** PR 1 stops reading/writing the column; PR 2 drops it.
  Never drop a column the deployed code still references.
- **Column rename = 3 PRs.** PR 1 adds the new column and dual-writes; PR 2 moves
  reads to the new column; PR 3 drops the old one. (A rename is a drop with an
  add, so it inherits the drop's caution.)

This keeps every intermediate deploy runnable against both the old and new
schema, which matters because the worker and its migrations roll out separately.

**Workflow.** The schema baseline is committed in `packages/api/drizzle/` (the
`0000_*` migration creates every table). After editing `schema.ts`, run
`pnpm db:generate` to emit the next migration, commit it alongside the schema
change, and `pnpm db:migrate` applies pending migrations (locally and in the
e2e CI / deploy). A fresh database is provisioned entirely by `db:migrate` — it
is never set up by hand or by `drizzle-kit push`.

## Dev & test branch isolation

Neon's branching gives each environment its own database without a separate
server:

- **Dev** runs against a dev branch seeded from migrations.
- **Test** runs against a **dedicated test branch** that `global-setup` **wipes
  and re-migrates before every Playwright run**, so suites start from a known
  empty schema and never collide with dev data. See [testing.md](testing.md).
