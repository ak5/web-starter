import { defineConfig, devices } from '@playwright/test';

import { adminUrl, apiUrl, webUrl } from './tests/helpers/env';

/**
 * Three projects, run against the live dev stack (`pnpm dev` + `pnpm test`, or
 * the CI `e2e` job). `api` drives the HTTP API directly (no browser); `web` and
 * `admin` are browser suites. Tests self-isolate via unique credentials + a
 * per-test synthetic client IP (see `tests/helpers/api.ts`) — no shared global
 * state — and `pnpm test:preflight` gates reachability before the suite.
 */
export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,

	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	projects: [
		{
			name: 'api',
			testMatch: /tests\/api\/.*\.spec\.ts/,
			use: { baseURL: apiUrl }
		},
		{
			name: 'web',
			testMatch: /tests\/web\/.*\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: webUrl }
		},
		{
			name: 'admin',
			testMatch: /tests\/admin\/.*\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: adminUrl }
		},
		// Deployment golden-path smoke. Excluded from the default `pnpm test`
		// (dev e2e) — run explicitly against a live URL via `pnpm test:smoke`:
		//   PUBLIC_API_URL=https://ak5-api.ak5.workers.dev pnpm test:smoke
		{
			name: 'smoke',
			testMatch: /tests\/smoke\/.*\.spec\.ts/
		}
	]
});
