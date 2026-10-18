# ADR 0004 — One tokens table with an exclusive-arc check

**Status:** Accepted

## Context

The system has **two identity tables** by design: `users` and `admin_users`.
Several flows mint short-lived, single-use tokens that belong to one of those
identities — email verification, password reset, and magic (passwordless) login.
Each token row must point at exactly one subject, and that subject is either a
user or an admin, never both and never neither. The question is how to model the
ownership of a token row against two possible owner tables.

## Decision

Use a **single `tokens` table** with two nullable foreign keys — `user_id` and
`admin_id` — guarded by an **exclusive-arc `CHECK` constraint**:

```sql
CHECK (num_nonnulls(user_id, admin_id) = 1)
```

Exactly one of the two columns is non-null on every row; the database rejects any
row that sets both or neither. A `token_purpose` enum
(`verify_email` / `reset_password` / `magic_login` / …) discriminates the flow.
One table, one set of issue/consume/expire logic, integrity enforced by Postgres.

## Consequences

- The "exactly one owner" invariant is enforced by the database, not by
  application code that could drift.
- All token lifecycle logic — issuance, single-use consumption, expiry, cleanup —
  lives in one place and serves both identities and every purpose.
- Adding a new token purpose is a new enum value, not a new table.
- Cost: two nullable FK columns where a tidier-looking design might want one. Code
  that reads a token must branch on which column is set. This is a small, local
  cost and the `CHECK` makes the branch total.
- This shape is **load-bearing** and ties to the two-identity-table model — do not
  collapse it into a single owner column without revisiting the auth design.

## Alternatives considered

- **Two token tables** (`user_tokens`, `admin_tokens`): duplicates the entire
  token lifecycle and every query against it; divergence is a matter of time.
- **Polymorphic FK** (`subject_type` + `subject_id` with no real FK): no
  referential integrity — `subject_id` can point at a row that does not exist, and
  the database cannot cascade or validate it. The exclusive-arc keeps real foreign
  keys on both arms.
