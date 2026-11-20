# ak5-web — agent instructions

All conventions live in [CLAUDE.md](CLAUDE.md) — read it first; everything
there applies to every agent, not just Claude.

**`tmp/`** is the normal scratch pad — throwaway files, local notes, one-off
outputs; gitignored except `tmp/.gitkeep`.

Run Prettier and the applicable quality gates locally before using GitHub Actions
for feedback. Start with `nice -n 10 pnpm format` and
`nice -n 10 pnpm check:all`. Run applicable tests and builds sequentially, with
one Playwright worker. See the code quality section in CLAUDE.md.
