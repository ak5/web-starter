#!/bin/bash
# First-time local dev setup. Syncs each package .env with its .env.example
# keys, rotates a shared JWT_SECRET across workers, and prints the manual setup
# still required (optional provider secrets).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGES=(api web admin)

echo "=== Dev environment setup ==="
echo ""

for pkg in "${PACKAGES[@]}"; do
	EXAMPLE="$REPO_ROOT/packages/$pkg/.env.example"
	ENV_FILE="$REPO_ROOT/packages/$pkg/.env"

	if [ ! -f "$EXAMPLE" ]; then
		echo "-> @ak5/$pkg: no .env.example (skipping)"
		continue
	fi
	if [ ! -f "$ENV_FILE" ]; then
		cp "$EXAMPLE" "$ENV_FILE"
		echo "-> @ak5/$pkg: created .env from .env.example"
		continue
	fi

	appended=()
	while IFS= read -r line; do
		case "$line" in '' | '#'*) continue ;; esac
		key="${line%%=*}"
		if ! grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
			printf '%s\n' "$line" >> "$ENV_FILE"
			appended+=("$key")
		fi
	done < "$EXAMPLE"

	if [ ${#appended[@]} -eq 0 ]; then
		echo "-> @ak5/$pkg: .env up to date"
	else
		echo "-> @ak5/$pkg: appended new key(s): ${appended[*]}"
	fi
done
echo ""

echo "=== Generating shared JWT_SECRET across worker .env files ==="
bash "$REPO_ROOT/scripts/rotate-jwt-secret.sh"
echo ""

cat <<'EOF'
=== Next steps ===

Local D1 uses Wrangler persistence and needs no account credentials.
Optional provider secrets — fill only what you test locally:
   DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET (OAuth login),
   TOKEN_ENCRYPTION_KEY (`openssl rand -hex 32`), Cloudflare read tokens.

Then:

   pnpm db:migrate
   pnpm create:admin
   pnpm dev:auto

See docs/development/setup.md and docs/architecture/database.md.
EOF
