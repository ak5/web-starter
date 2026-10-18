# Testing

| Layer            | Command                       | Storage                               |
| ---------------- | ----------------------------- | ------------------------------------- |
| Unit             | `pnpm test:unit`              | Pure helpers and explicit mocks       |
| Integration      | `pnpm test:db`                | Disposable real local D1 bindings     |
| Browser/API      | `pnpm test --workers=1`       | Running local stack and its local D1  |
| Deployment smoke | `pnpm test:smoke --workers=1` | Explicitly configured live deployment |

Run CPU-intensive commands with `nice -n 10`. Keep suites sequential and use one
Playwright worker. `pnpm check:all` formats, lints, checks boundaries/doc links and
typechecks. `pnpm build:mobile` checks both native JavaScript bundles; native
Xcode/Gradle builds and device tests are separate.

## Local tests

Run `nice -n 10 pnpm test:unit`, then `nice -n 10 pnpm test:db`. The integration
harness uses Wrangler's supported binding proxy with persistence and remote
bindings disabled and no local environment files loaded. It applies migrations
to an empty D1 database and disposes of the runtime afterward. There are no
provider credentials or test-skipping environment variables.

For Playwright, run `pnpm dev:init` once, `pnpm db:migrate`, then `pnpm dev:auto`.
Read `.env.dev-slot`; `pnpm test:preflight` verifies reachability. Reuse an existing
stack if it is yours and reachable. Tests create unique accounts and use the local
email mock, never real recipients. For an entirely disposable database, use a
fresh checkout. Never point browser tests at production.

## Public CI

`quality-gates` runs formatting, lint, types, boundary checks, units and builds.
`mobile` checks the native app and both JavaScript bundles. `db-tests` runs the
D1 integration suite. `e2e` initializes local D1 and runs the complete stack and
Playwright with one worker. `migrate-check` checks the migration journal, applies
the baseline locally, then applies it again to prove repeat safety.

These jobs run without database or deployment secrets, including approved fork
PRs. Only trusted same-repository previews receive staging deployment credentials.
Preview and production smoke tests are separate from the local test suites.
