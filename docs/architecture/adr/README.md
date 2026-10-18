# Architecture Decision Records

These ADRs capture the **why** behind the load-bearing choices in this app — the
ones that shape everything built on top of them and are expensive to reverse. If
a decision is structural (a table shape, an auth model, a build boundary) and a
future contributor might reasonably ask "why is it done this way?", it earns an
ADR. Routine choices that any reasonable person would make the same way do not.

These are the **generated app's** decisions. They describe how this codebase is
put together, independent of any product or brand.

## Format

Every ADR is a single Markdown file named `NNNN-short-slug.md` with this shape:

```
# ADR NNNN — <title>

**Status:** Accepted

## Context
The forces in play: the runtime, the constraints, the problem being solved.

## Decision
The choice that was made, stated plainly.

## Consequences
What this buys us and what it costs — both directions.

## Alternatives considered
What else was on the table and why it lost.
```

`Status` is one of **Proposed**, **Accepted**, **Superseded by NNNN**, or
**Deprecated**.

## Supersede, don't delete

An ADR is a historical record. When a decision changes, **write a new ADR** that
supersedes the old one and flip the old record's status to `Superseded by NNNN`.
Never edit an accepted decision into something it never said, and never delete
the file — a reader who follows an old link or commit should still find the
reasoning that was true at the time.

## Index

| ADR                                      | Title                                        | Status   |
| ---------------------------------------- | -------------------------------------------- | -------- |
| [0001](0001-postgres-over-sqlite.md)     | Postgres over edge SQLite/KV                 | Accepted |
| [0002](0002-jwt-over-server-sessions.md) | Stateless JWT over server-side sessions      | Accepted |
| [0003](0003-split-workers.md)            | Split workers per surface                    | Accepted |
| [0004](0004-exclusive-arc-tokens.md)     | One tokens table with an exclusive-arc check | Accepted |
| [0005](0005-public-ids.md)               | Prefixed public IDs everywhere               | Accepted |
| [0006](0006-hono-rpc-client.md)          | Hono RPC client centralized in `@ak5/webui`  | Accepted |
