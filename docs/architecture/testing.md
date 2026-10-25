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

Use `pnpm peers check` and `pnpm audit` after dependency updates. The workspace
keeps the React Native, Expo, and Symbiote native dependencies aligned, including
the Hermes compiler used by bundle verification. Pure TypeScript checks use the
native TypeScript 7 compiler; Svelte and ESLint use the TypeScript 6 API package.
`build:libs` first generates Cloudflare binding and runtime types from each
Worker's configuration. Generated declarations stay local and are also created
in CI before compilation.

## Local tests

Run `nice -n 10 pnpm test:unit`, then `nice -n 10 pnpm test:db`. The integration
harness uses Wrangler's supported binding proxy with persistence and remote
bindings disabled and no local environment files loaded. It applies migrations
to an empty D1 database and disposes of the runtime afterward. There are no
provider credentials or test-skipping environment variables.

Secret-sync unit tests use a fake Wrangler command to verify overrides, retained
Worker keys, and failure when a required key is absent from both locations.

For Playwright, run `pnpm dev:init` once, `pnpm db:migrate`, then `pnpm dev:auto`.
Read `.env.dev-slot`; `pnpm test:preflight` verifies reachability. Reuse an existing
stack if it is yours and reachable. Tests create unique accounts and use the local
email mock, never real recipients. For an entirely disposable database, use a
fresh checkout. Never point browser tests at production.

## Public CI

`quality-gates` runs formatting, lint, types, boundary checks, units and builds.
It also rejects dependency peer conflicts and npm advisories of low severity or
higher before building libraries.
`mobile` checks the native app and both JavaScript bundles. `db-tests` runs the
D1 integration suite. `e2e` initializes local D1 and runs the complete stack and
Playwright with one worker. `migrate-check` checks the migration journal, applies
the baseline locally, then applies it again to prove repeat safety.

These jobs run without database or deployment secrets, including approved fork
PRs. Only trusted same-repository previews receive development deployment credentials.
Preview and production smoke tests are separate from the local test suites.

## Local-first notes

Unit tests in `@ak5/sync` check that pending changes remain visible until server
acknowledgement, including after local SQLite persistence.
D1 integration tests cover sync ownership, session expiry, deleted/banned users,
and event validation. The web notes Playwright test uses separate browser
contexts to check offline writes, unsynced OPFS persistence after reload, reconnection,
cross-device updates/deletion, and account isolation through the real sync
endpoint. See [local-first notes](local-first.md).

Commit hooks format packages sequentially, including `@ak5/sync`, and run checks
with reduced CPU priority and one workspace job at a time.

`pnpm build:mobile` bundles both platforms and compiles each result with the
React Native-matched Hermes compiler. This catches syntax that Metro accepts
but the device runtime cannot execute.

Native module tests resolve the installed Expo graph for Apple and Android and
require SQLite, authentication, and their runtime modules to be linked. They check
class registrations and the Expo Modules 2 annotations/build targets used by
Application and SQLite. Merely
installing a JavaScript package does not guarantee its native module is available.

Environment banner browser checks cover dismissal, reappearance after client
navigation and reload, and shared web/admin rendering. Promotion self-checks
exercise all four hosted-dev/staging profiles and reject wrong-SHA, expired,
failed, skipped and untrusted deployment qualifications.
