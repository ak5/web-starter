# Documentation index

Four buckets, by question answered. **product/** = what we're building.
**architecture/** = how it's built. **development/** = how to run it locally.
**operations/** = how to run it in prod. New docs slot into one of these — no
`misc/`, no docs at the `docs/` root. After adding/renaming/removing a doc,
update this index in the **same PR**.

## product/ — what we're building

| File                                             | One-liner                               |
| ------------------------------------------------ | --------------------------------------- |
| [functional-spec.md](product/functional-spec.md) | The example surface and what to replace |

## architecture/ — how it's built

| File                                          | One-liner                                        |
| --------------------------------------------- | ------------------------------------------------ |
| [overview.md](architecture/overview.md)       | The split-monorepo shape, end to end             |
| [auth.md](architecture/auth.md)               | Identity tables, tokens, JWT, the route split    |
| [local-first.md](architecture/local-first.md) | LiveStore, local SQLite, D1 sync, offline limits |
| [database.md](architecture/database.md)       | Tables, Drizzle, migration policy                |
| [rpc.md](architecture/rpc.md)                 | The typed Hono client contract                   |
| [security.md](architecture/security.md)       | Public IDs, rate limits, secrets, cookies        |
| [api/](architecture/api/index.md)             | How API routes are organized                     |
| [cron.md](architecture/cron.md)               | Scheduled-handler pattern, adding a job          |
| [platforms.md](architecture/platforms.md)     | OAuth login provider integration                 |
| [testing.md](architecture/testing.md)         | Playwright + test-DB isolation strategy          |
| [adr/](architecture/adr/README.md)            | Architecture decision records                    |

## development/ — how to run it locally

| File                                             | One-liner                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| [start-project.md](development/start-project.md) | One-command creation and reversible mobile profiles |
| [setup.md](development/setup.md)                 | First run, dev slots, the stack                     |
| [conventions.md](development/conventions.md)     | File layout, naming, imports, commits               |
| [contributing.md](development/contributing.md)   | Branching, CI, review, migration policy             |
| [add-a-persona.md](development/add-a-persona.md) | Recipe for a 3rd+ SvelteKit frontend                |

## operations/ — how to run it in prod

| File                                                      | One-liner                                |
| --------------------------------------------------------- | ---------------------------------------- |
| [deployment.md](operations/deployment.md)                 | Cloudflare workers, domains, secrets     |
| [email-sending.md](operations/email-sending.md)           | Sender onboarding and inbox verification |
| [3rd-party-services.md](operations/3rd-party-services.md) | D1, email sender, OAuth providers        |

## Top-level

| File                         | One-liner                          |
| ---------------------------- | ---------------------------------- |
| [../CLAUDE.md](../CLAUDE.md) | Canonical conventions — read first |
| [../README.md](../README.md) | Repo overview + quickstart         |

- [Native mobile setup](../packages/mobile/README.md) — Svelte / Symbiote / React Native.
