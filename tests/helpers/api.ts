import { type APIRequestContext, type Playwright, expect } from '@playwright/test';

import { apiUrl } from './env';

/**
 * Helpers for the API test project. Each test gets its own request context with
 * a **distinct `x-forwarded-for`** so the per-IP pre-login rate limiter (see
 * `packages/api/src/middleware/rate-limit.ts`) never bleeds across tests, plus
 * collision-free credentials so parallel registrations don't fight.
 */
let counter = 0;

export function syntheticIp(): string {
	// Random per call — must be unique across PARALLEL Playwright worker
	// processes (each has its own module state), or two tests would share a
	// rate-limit bucket. Uniqueness, not realism, is the point.
	const octet = () => 1 + Math.floor(Math.random() * 254);
	return `10.${octet()}.${octet()}.${octet()}`;
}

export function uniqueEmail(): string {
	return `e2e_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export function uniqueUsername(): string {
	// 5–20 chars, [A-Za-z0-9_] — matches the API's usernameSchema.
	return `u${Date.now()}${counter}`.slice(0, 20);
}

/** A fresh API request context with a unique client IP (own cookie jar). */
export async function newApiContext(playwright: Playwright): Promise<APIRequestContext> {
	const ip = syntheticIp();
	// The rate limiter reads `cf-connecting-ip ?? x-forwarded-for`. Dev/CI runs
	// under `wrangler dev`, where `cf-connecting-ip` is settable (real Cloudflare
	// sets it itself), so we send both to land in a unique bucket per test.
	return playwright.request.newContext({
		baseURL: apiUrl,
		extraHTTPHeaders: { 'cf-connecting-ip': ip, 'x-forwarded-for': ip }
	});
}

export interface TestUser {
	email: string;
	username: string;
	password: string;
}

/** Register a throwaway user; the returned context is authenticated (cookie set). */
export async function registerUser(api: APIRequestContext): Promise<TestUser> {
	const user: TestUser = {
		email: uniqueEmail(),
		username: uniqueUsername(),
		password: 'password1234'
	};
	const res = await api.post('/auth/register', {
		data: { ...user, legalAcceptance: true }
	});
	expect(res.status(), `register failed: ${await res.text()}`).toBe(200);
	return user;
}
