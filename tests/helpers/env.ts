import { existsSync, readFileSync } from 'node:fs';

/**
 * Resolve the dev-stack base URLs the Playwright projects target. Mirrors
 * `scripts/preflight.ts`: prefer the generated `.env.dev-slot` (the active dev
 * slot's ports/URLs), then process env, then the slot-1 Caddy defaults.
 */
function readSlotEnv(): Record<string, string> {
	const file = '.env.dev-slot';
	if (!existsSync(file)) return {};
	const out: Record<string, string> = {};
	for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
		if (!line || line.startsWith('#')) continue;
		const i = line.indexOf('=');
		if (i === -1) continue;
		out[line.slice(0, i)] = line.slice(i + 1);
	}
	return out;
}

const slot = readSlotEnv();

export const apiUrl =
	slot.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? 'http://api.ak5.localhost:8359';
export const webUrl =
	slot.PUBLIC_WEB_URL ?? process.env.PUBLIC_WEB_URL ?? 'http://web.ak5.localhost:8359';
export const adminUrl =
	slot.PUBLIC_ADMIN_URL ?? process.env.PUBLIC_ADMIN_URL ?? 'http://admin.ak5.localhost:8359';
export const mockUrl =
	slot.AK5_MOCK_URL ?? process.env.AK5_MOCK_URL ?? 'http://mock.ak5.localhost:8359';
