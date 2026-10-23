# Contributing

Create a short-lived branch from `main`, open a PR into `main`, and keep CI green.
PR previews run their own API/web/admin Workers with the shared staging database.
Only trusted same-repository PRs receive preview credentials; fork and Dependabot
PRs run CI without preview deployments.

Merging to `main` automatically tests and deploys staging. To release, manually
run `promote.yml` from `main` with the full SHA of a successful staging deployment.
See [deployment](../operations/deployment.md) for the promotion gate.

## CI — the `quality-gates` check

`quality-gates` is the **required** status check on every PR; a PR can't merge
until it's green. (PRs into `main` additionally require `migrate-check` — see [../operations/deployment.md](../operations/deployment.md).)
The frozen dependency install must first pass `pnpm peers check` and
`pnpm audit --audit-level=low`.

It then runs, in order:

1. `pnpm -w run build:libs` — build libraries in dependency order
2. `pnpm format:check` — Prettier, zero diffs
3. `pnpm -r lint:nofmt` — ESLint across packages
4. `pnpm audit:split` — package boundary + instruction-file drift checks
5. `pnpm -r check` — `svelte-check` / `tsc --noEmit`
6. `pnpm test:unit` — unit suites
7. `pnpm -w run build` — full build

`db-tests` runs `pnpm test:db` against disposable local D1 bindings. `e2e` runs
the full local stack with Playwright. Both run without provider credentials.

## Reproduce locally before pushing

```sh
nice -n 10 pnpm check:all
```

`check:all` runs the same gates locally (build:libs → format → lint → audit:split
→ check). **Zero errors AND zero warnings** is the bar — fix warnings, don't defer
them. The lefthook pre-commit hook runs a piped subset
(format → lint → audit-split → check) so most breakage is caught before it leaves
your machine.

## Review & merge

- **Rebase-and-merge** to keep history linear. No merge commits.
- Rebase on `main` before merging if your branch has fallen behind.
- Promote the tested staging SHA manually when ready for production.

## Database migration policy

Drizzle migrations are **forward-only and additive**. The rules:

- **One migration per PR.** Generate it from the schema change in the same PR;
  never hand-edit applied migrations.
- **Additive-only by default** — add columns/tables; don't mutate or drop in place.
- **Dropping a column is a 2-PR sequence:** PR 1 stops reading/writing it; PR 2
  drops it once the old code is fully deployed.
- **Renaming is a 3-PR sequence:** add the new column → backfill + dual-write and
  cut reads over → drop the old column.

This keeps every deployed revision compatible with the live database during
rollout.

## Docs ↔ code stay in sync

Every PR that touches the left column of the table in
[`../../CLAUDE.md`](../../CLAUDE.md) (API endpoint, DB table, route, auth, cron,
OAuth, a new persona, deploy config, a 3rd-party service, …) **must** update the
listed doc in the same PR. After adding/renaming/removing any doc, update
[`../index.md`](../index.md) in that same PR. A reader should never hit a
reference to something that no longer exists.

## Dependency updates

`.github/dependabot.yml` enables weekly updates for the pnpm workspace, GitHub
Actions, mobile Ruby gems, and Android Gradle dependencies. Updates target the
default branch. Patch/minor updates are grouped by ecosystem; major updates open
separate PRs. All updates require review, and automatic merging is disabled.
Dependabot PRs run CI without deployment credentials or preview deployments.

Enable Dependabot alerts and security updates in the repository's code security
settings. Fork owners configure these settings on their own repository. See the
[Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
