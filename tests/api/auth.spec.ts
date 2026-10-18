import { test, expect } from '@playwright/test';

import { newApiContext, registerUser, uniqueEmail, uniqueUsername } from '../helpers/api';

test.describe('auth', () => {
	test('register → me → logout', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		const user = await registerUser(api);

		const me = await api.get('/auth/me');
		expect(me.status()).toBe(200);
		expect((await me.json()).email).toBe(user.email);

		const logout = await api.post('/auth/logout');
		expect(logout.ok()).toBeTruthy();

		// The cookie is cleared → the session is gone.
		const after = await api.get('/auth/me');
		expect(after.status()).toBe(401);
		await api.dispose();
	});

	test('register then log in on a fresh client', async ({ playwright }) => {
		const setup = await newApiContext(playwright);
		const user = await registerUser(setup);
		await setup.dispose();

		const api = await newApiContext(playwright);
		const login = await api.post('/auth/login', {
			data: { email: user.email, password: user.password }
		});
		expect(login.status()).toBe(200);
		const me = await api.get('/auth/me');
		expect(me.status()).toBe(200);
		expect((await me.json()).email).toBe(user.email);
		await api.dispose();
	});

	test('register requires legal acceptance', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		const res = await api.post('/auth/register', {
			data: {
				email: uniqueEmail(),
				username: uniqueUsername(),
				password: 'password1234'
				// legalAcceptance intentionally omitted
			}
		});
		expect(res.status()).toBe(400);
		await api.dispose();
	});

	test('register rejects an invalid username', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		const res = await api.post('/auth/register', {
			data: {
				email: uniqueEmail(),
				username: 'no', // < 5 chars
				password: 'password1234',
				legalAcceptance: true
			}
		});
		expect(res.status()).toBe(400);
		await api.dispose();
	});

	test('the same email cannot register twice', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		const user = await registerUser(api);
		const dup = await api.post('/auth/register', {
			data: {
				email: user.email,
				username: uniqueUsername(),
				password: 'password1234',
				legalAcceptance: true
			}
		});
		expect(dup.status()).toBeGreaterThanOrEqual(400);
		expect(dup.status()).toBeLessThan(500);
		await api.dispose();
	});

	test('login rejects a wrong password', async ({ playwright }) => {
		const setup = await newApiContext(playwright);
		const user = await registerUser(setup);
		await setup.dispose();

		const api = await newApiContext(playwright);
		const res = await api.post('/auth/login', {
			data: { email: user.email, password: 'wrong-password-9999' }
		});
		expect(res.status()).toBe(401);
		await api.dispose();
	});

	test('login rejects an unknown account', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		const res = await api.post('/auth/login', {
			data: { email: uniqueEmail(), password: 'password1234' }
		});
		expect(res.status()).toBe(401);
		await api.dispose();
	});

	test('me requires authentication', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		expect((await api.get('/auth/me')).status()).toBe(401);
		await api.dispose();
	});
});
