import { test, expect } from '@playwright/test';

import { apiUrl } from '../helpers/env';

/**
 * Golden-path smoke for a LIVE deployment (prod or staging) — a quick "is the
 * whole stack actually working?" check you can run against a real URL:
 *
 *   PUBLIC_API_URL=https://ak5-api.ak5.workers.dev pnpm test:smoke
 *
 * It deliberately differs from the dev e2e suite (tests/api, …):
 *  - It does NOT spoof `cf-connecting-ip` — real Cloudflare 403s a client-set
 *    value, so the dev suite's per-test fake IP can't reach a deployment.
 *  - It makes only one register + one login, so it stays under the auth rate
 *    limits even though every request shares one real IP.
 *  - It self-cleans: the throwaway account is soft-deleted (DELETE /me) at the
 *    end, so running it against prod leaves no trace.
 */
test('golden path against a live deployment', async ({ playwright }) => {
	const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
	const user = {
		email: `smoke_${stamp}@example.test`,
		username: `smoke${stamp}`.slice(0, 20),
		password: 'password1234'
	};

	// Plain context — no cf-connecting-ip header, so Cloudflare accepts it.
	const api = await playwright.request.newContext({ baseURL: apiUrl });

	// 1. Register → authenticated session (cookie on this context).
	const reg = await api.post('/auth/register', { data: { ...user, legalAcceptance: true } });
	expect(reg.status(), `register: ${await reg.text()}`).toBe(200);

	// 2. The session works.
	const me = await api.get('/auth/me');
	expect(me.status()).toBe(200);
	expect((await me.json()).email).toBe(user.email);

	// 3. Item round-trip: create → see it listed → delete.
	const created = await api.post('/items', { data: { data: { title: 'smoke' } } });
	expect(created.status(), `create item: ${await created.text()}`).toBe(201);
	const item = await created.json();
	expect(item.id).toMatch(/^i-/);
	const list = await api.get('/items');
	expect(list.status()).toBe(200);
	expect(((await list.json()).items as { id: string }[]).map((i) => i.id)).toContain(item.id);
	expect((await api.delete(`/items/${item.id}`)).status()).toBe(200);

	// 4. Logout, then log back in on a fresh client → proves login works.
	expect((await api.post('/auth/logout')).ok()).toBeTruthy();
	const fresh = await playwright.request.newContext({ baseURL: apiUrl });
	const login = await fresh.post('/auth/login', {
		data: { email: user.email, password: user.password }
	});
	expect(login.status(), `login: ${await login.text()}`).toBe(200);
	expect((await fresh.get('/auth/me')).status()).toBe(200);

	// 5. Clean up: soft-delete the throwaway account (recent-auth is satisfied by
	//    the login above), so the smoke leaves no trace in the deployment's DB.
	const del = await fresh.delete('/me');
	expect(del.ok(), `delete account: ${del.status()} ${await del.text()}`).toBeTruthy();

	// 6. Confirm it's gone — the deleted account can no longer log in.
	const after = await playwright.request.newContext({ baseURL: apiUrl });
	const reLogin = await after.post('/auth/login', {
		data: { email: user.email, password: user.password }
	});
	expect(reLogin.status()).toBe(401);

	await api.dispose();
	await fresh.dispose();
	await after.dispose();
});
