#!/bin/bash
# Print the lowest dev slot whose ports are ALL free.
#
# A slot reserves a fixed set of ports (base + (slot-1)*10): api 8350, web 8351,
# admin 8352, email preview 8354, email mock 8355, Caddy 8359. We check every
# one — not just the api — so `pnpm dev:auto` never lands on a slot whose web or
# Caddy port is already held by something else. The base ports here must match
# scripts/dev-host.sh (the authoritative mapping).

set -e

# Base ports for slot 1; the slot offset (+10 per slot) is applied below.
BASE_PORTS=(8350 8351 8352 8354 8355 8359)

port_in_use() {
	lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

for slot in 1 2 3 4 5 6 7 8 9; do
	offset=$(((slot - 1) * 10))
	busy=""
	for base in "${BASE_PORTS[@]}"; do
		if port_in_use $((base + offset)); then
			busy="$((base + offset))"
			break
		fi
	done
	if [ -z "$busy" ]; then
		echo "$slot"
		exit 0
	fi
done

echo "Error: slots 1-9 all have at least one port in use (bases ${BASE_PORTS[*]}, +10/slot)." >&2
exit 1
