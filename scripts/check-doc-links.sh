#!/bin/bash
# Validate relative links + image targets in every Markdown file.
#
# Catches the common rot: a doc points at `../foo.md` (or an image) that was
# moved/renamed/never created. Checks the *file* part of each relative target
# resolves on disk. External links (http/https/mailto), pure in-page anchors
# (`#section`), and the anchor/query suffix of a path are intentionally NOT
# checked — file existence is the high-signal, false-positive-free invariant.
#
# Scope: tracked + new (non-gitignored) `*.md`, so freshly added docs are
# covered before they are committed. Run via `pnpm check:docs`; part of
# `check:all` and CI.

set -eu

cd "$(dirname "$0")/.."

broken="$(mktemp)"
trap 'rm -f "$broken"' EXIT

# Tracked + untracked-but-not-ignored markdown (so new docs are linted too).
# Falls back to a tree walk when there's no git repo yet (e.g. before the
# first `git init`, or when running from an unpacked tarball).
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	files="$(git ls-files --cached --others --exclude-standard '*.md')"
else
	files="$(find . -type d \( -name node_modules -o -name .svelte-kit -o -name dist -o -name build -o -name .git \) -prune -o -type f -name '*.md' -print | sed 's#^\./##')"
fi

while IFS= read -r f; do
	[ -n "$f" ] || continue
	dir="$(dirname "$f")"
	# Extract every inline link/image target: the `(...)` in `](...)`. `|| true`
	# so a file with no links (grep exit 1) doesn't trip `set -e`.
	targets="$(grep -oE '\]\([^)]+\)' "$f" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//' || true)"
	[ -n "$targets" ] || continue
	while IFS= read -r raw; do
		# Drop an optional "title" / 'title' after the path.
		target="$(printf '%s' "$raw" | sed -E 's/[[:space:]]+["'"'"'].*$//')"
		[ -n "$target" ] || continue
		case "$target" in
			http://* | https://* | mailto:* | tel:* | data:* | //* | \#*) continue ;;
		esac
		# Strip anchor and query — we validate the file, not the fragment.
		path="${target%%#*}"
		path="${path%%\?*}"
		[ -n "$path" ] || continue
		if [ ! -e "$dir/$path" ]; then
			printf '%s -> %s\n' "$f" "$target" >>"$broken"
		fi
	done <<<"$targets"
done <<<"$files"

if [ -s "$broken" ]; then
	echo "FAIL: broken relative links in docs:" >&2
	sed 's/^/    /' "$broken" >&2
	exit 1
fi

echo "OK:   all relative doc links resolve"
