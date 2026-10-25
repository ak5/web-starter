#!/bin/bash
# Wait for the dev API, then print the URLs for the active slot.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOT_FILE="$REPO_ROOT/.env.dev-slot"

if [ ! -f "$SLOT_FILE" ]; then
	echo "[banner] $SLOT_FILE missing — skipping ready banner." >&2
	exit 0
fi

# shellcheck disable=SC1090
. "$SLOT_FILE"

if [ "$DEV_MODE" = "tailscale" ]; then
	TARGET="http://127.0.0.1:${AK5_API_PORT}/healthz"
else
	TARGET="http://api.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}/healthz"
fi

ready=0
for _ in $(seq 1 180); do
	if curl --max-time 2 --fail -s -o /dev/null "$TARGET" 2>/dev/null; then
		ready=1
		break
	fi
	sleep 0.5
done

if [ "$ready" -eq 0 ]; then
	printf "\n\033[33m  Slot %s API never became reachable at %s — printing URLs anyway.\033[0m\n" "$AK5_SLOT" "$TARGET" >&2
fi

B="\033[1m"; D="\033[2m"; G="\033[32m"; C="\033[36m"; R="\033[0m"

printf "\n"
printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"

if [ "$DEV_MODE" = "tailscale" ]; then
	printf "${B}  Slot ${AK5_SLOT} tailnet ready${R}  —  phone opens any of:\n"
	printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
	printf "    ${C}http://${AK5_SUFFIX}:${AK5_WEB_PORT}${R}\n"
	printf "    ${C}http://${AK5_SUFFIX}:${AK5_ADMIN_PORT}${R}\n"
	printf "    ${C}http://${AK5_SUFFIX}:${AK5_API_PORT}${R}\n"
else
	printf "${B}  Slot ${AK5_SLOT} local ready${R}  —  open any of:\n"
	printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
	printf "    ${C}http://web.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}${R}\n"
	printf "    ${C}http://admin.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}${R}\n"
	printf "    ${C}http://api.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}${R}      ${D}# /healthz, /me${R}\n"
	printf "    ${C}http://mock.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}${R}     ${D}# email inbox${R}\n"
	printf "    ${C}http://preview.${AK5_NS}.${AK5_SUFFIX}:${AK5_CADDY_PORT}${R}  ${D}# Svelte email preview${R}\n"
fi

printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "\n"

while true; do sleep 3600; done
