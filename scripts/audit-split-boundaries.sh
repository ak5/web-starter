#!/usr/bin/env bash
#
# Split-boundary audit. Mechanically enforces the package architecture AND keeps
# the agent-guidance files (CLAUDE.md, copilot-instructions.md) honest. Wired
# into `pnpm check:all`, the lefthook pre-commit hook, and CI `quality-gates`.
#
# Add a check when you add an invariant worth defending. Each check prints OK/FAIL
# and any FAIL fails the whole run. Keep checks fast (ripgrep over the tree).
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

# FAIL if PATTERN is found in the given paths.
check_absent() {
	local label="$1" pattern="$2"; shift 2
	if rg --pcre2 -n --no-messages "$pattern" "$@" >/dev/null 2>&1; then
		red "FAIL: $label"
		rg --pcre2 -n --no-messages "$pattern" "$@" | sed 's/^/    /' | head -n 10
		fail=1
	else
		green "OK:   $label"
	fi
}

# FAIL if PATTERN is NOT found in FILE (a convention that must still be stated).
check_present() {
	local label="$1" pattern="$2" file="$3"
	if rg -n --no-messages "$pattern" "$file" >/dev/null 2>&1; then
		green "OK:   $label"
	else
		red "FAIL: $label (expected to find /$pattern/ in $file)"
		fail=1
	fi
}

WEB_SRC=(packages/web/src packages/admin/src)
FRONTEND_SRC=("${WEB_SRC[@]}" packages/mobile/src packages/mobile/App.svelte)

# --- Package boundaries -------------------------------------------------------

# Frontends consume the API type-only. A value import of the api package from a
# frontend means runtime coupling — forbidden.
check_absent "frontends import @ak5/api type-only (no runtime import)" \
	"^[[:space:]]*import +(?!type )[^;]*from +['\"]@ak5/api" "${FRONTEND_SRC[@]}"

# Native runtime imports must avoid Worker-only JWT initialization.
check_absent "mobile imports shared runtime through native-safe subpaths" \
    "^[[:space:]]*import +(?!type )[^;]*from +['\"]@ak5/shared['\"]" \
    packages/mobile/src packages/mobile/App.svelte

# Frontends reach shared behavior through @ak5/webui, not direct @ak5/shared.
check_absent "frontends do not import @ak5/shared directly (use @ak5/webui)" \
	"from +['\"]@ak5/shared" "${WEB_SRC[@]}"

# The email+password auth core must never import the removable OAuth overlay,
# so `auth-oauth` stays a clean delete (ADR: OAuth login is removable).
if [ -d packages/api/src/routes/auth ]; then
	check_absent "auth core does not import the auth-oauth overlay" \
		"auth-oauth|oauth/discord|oauth/google" \
		packages/api/src/routes/auth
fi

# SvelteKit route files stay thin: route modules delegate to package libs. Flag a
# route +page.server.ts / +server.ts longer than 60 lines as a smell.
while IFS= read -r f; do
	lines=$(wc -l < "$f")
	if [ "$lines" -gt 60 ]; then
		red "FAIL: thin-route — $f is $lines lines (move logic into a lib)"
		fail=1
	fi
done < <(rg -l --no-messages --glob '**/+*.server.ts' --glob '**/+server.ts' . packages/web/src packages/admin/src 2>/dev/null || true)
green "OK:   SvelteKit route modules stay thin"

# --- Agent-guidance freshness -------------------------------------------------

# The convention files must keep stating the load-bearing invariants. If a rule
# is silently dropped from CLAUDE.md, this fails — the docs can't rot unnoticed.
check_present "CLAUDE.md states the public-ID rule" \
	"never expose internal IDs" CLAUDE.md
check_present "CLAUDE.md states the clean-check gate" \
	"check:all.*passes cleanly|zero errors AND zero warnings" CLAUDE.md
check_present "CLAUDE.md states the docs/code sync rule" \
	"docs and code stay in sync" CLAUDE.md
check_present "copilot-instructions points at CLAUDE.md first" \
	"Read .*CLAUDE.md.* first" .github/copilot-instructions.md

# The guidance files must not reference retired concepts. Add terms here when you
# remove a feature, so stale agent guidance becomes a build error.
RETIRED_TERMS=""  # e.g. "old-provider|legacy-table" — empty until something is retired
if [ -n "$RETIRED_TERMS" ]; then
	check_absent "no retired terminology in agent-guidance files" \
		"$RETIRED_TERMS" CLAUDE.md .github/copilot-instructions.md docs
fi

# --- Docs placement -----------------------------------------------------------

# No stray docs at docs/ root — everything lives in a bucket (only index.md is
# allowed at the root).
STRAY=$(find docs -maxdepth 1 -type f -name '*.md' ! -name 'index.md' 2>/dev/null || true)
if [ -n "$STRAY" ]; then
	red "FAIL: docs at docs/ root must move into a bucket:"
	echo "$STRAY" | sed 's/^/    /'
	fail=1
else
	green "OK:   no stray docs at docs/ root"
fi

# --- Result -------------------------------------------------------------------

echo
if [ "$fail" -ne 0 ]; then
	red "Split boundary audit failed."
	exit 1
fi
green "Split boundary audit passed."
