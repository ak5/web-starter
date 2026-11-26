import { existsSync, readFileSync } from 'node:fs';

export function loadMobileEnvironment() {
	const envFile = new URL('../.env', import.meta.url);
	if (existsSync(envFile)) process.loadEnvFile(envFile);
	const rootSlotFile = new URL('../../../.env.dev-slot', import.meta.url);
	const rootSlot = existsSync(rootSlotFile) ? readFileSync(rootSlotFile, 'utf8') : '';
	process.env.EXPO_PUBLIC_MOBILE_API_URL ??= process.env.MOBILE_API_URL ?? '';
	process.env.EXPO_PUBLIC_MOBILE_API_PORT ??= rootSlot.match(/^AK5_API_PORT=(\d+)$/m)?.[1] ?? '';
}
