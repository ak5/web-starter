# @ak5/cli

Dev CLI wrapping the api endpoints. JSON output by default, `--pretty` for
readable output. Run via `pnpm cli`.

It keeps a **multi-persona identity store** at
`$XDG_CONFIG_HOME/ak5-cli/identities.json`, so you can hold `user` and `admin`
sessions side-by-side without re-login thrash. When run through `pnpm cli`, mise
points `XDG_CONFIG_HOME` at `<worktree>/.ak5-config`, so two checkouts never
share sessions.

## Commands

```bash
pnpm cli help
pnpm cli forgot-password intended-recipient@example.com  # application recovery email
pnpm cli login user@example.com password           # sign in (user)
pnpm cli login admin@example.com pw --type admin   # sign in (admin)
pnpm cli -i admin whoami                            # use the "admin" persona
pnpm cli token                                      # raw JWT (Playwright injection)
pnpm cli admin users                                # admin: list users
pnpm cli emails to user@example.com                 # query the mock email server
pnpm cli verify user@example.com                    # auto-extract PIN + verify
```

Add a command by adding a branch in `src/cli.ts` that calls `callApi(...)`
against the corresponding API route. Keep this README's command list in sync.

For a consented live email check, set `AK5_API_URL` to the configured environment
and run `pnpm cli forgot-password <intended-recipient>` (`--type admin` for an
admin account). Confirm the message in that inbox: the public response deliberately
does not disclose account existence or delivery failure. Use an account known to
exist in that environment. See [email setup](../../docs/operations/email-sending.md).
