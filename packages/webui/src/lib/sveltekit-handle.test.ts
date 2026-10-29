import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Handle } from '@sveltejs/kit/hooks';
import { createSvelteKitHandle } from './sveltekit-handle.js';
import { validateApiSession } from './api-client.js';
import { signJwt } from '@ak5/shared';

test('auth hook reads app runtime variables without a platform object', async () => {
	const env: { JWT_SECRET?: string; PUBLIC_COOKIE_ORIGIN?: string } = {
		JWT_SECRET: 'test-secret',
		PUBLIC_COOKIE_ORIGIN: ''
	};
	const handle = createSvelteKitHandle({
		env: () => env,
		allowedJwtType: 'user',
		validateSession: async () => true,
		isProtectedPath: (path) => path === '/private'
	});
	const event = {
		request: new Request('https://app.example.com/login'),
		url: new URL('https://app.example.com/login'),
		locals: {},
		cookies: { get: () => undefined }
	} as unknown as Parameters<Handle>[0]['event'];
	const input = { event, resolve: async () => new Response('ok') } as Parameters<Handle>[0];
	assert.equal((await handle(input)).status, 200);
	const response = await handle({
		...input,
		event: { ...event, url: new URL('https://app.example.com/private') }
	});
	assert.equal(response.status, 303);
	assert.equal(response.headers.get('location'), 'https://app.example.com/login?next=%2Fprivate');
	delete env.JWT_SECRET;
	await assert.rejects(async () => handle(input), /JWT_SECRET is not configured/);
	env.JWT_SECRET = 'test-secret';
	delete env.PUBLIC_COOKIE_ORIGIN;
	await assert.rejects(async () => handle(input), /PUBLIC_COOKIE_ORIGIN is not configured/);
});

test('revoked browser sessions clear cookies without a login redirect loop; outages preserve them', async () => {
	const token = await signJwt('test-secret', {
		sub: 'u-owner',
		email: 'owner@example.test',
		type: 'user',
		emailConfirmed: true,
		hasPassword: true,
		recentAuthAt: 1,
		sessionVersion: 3
	});
	let status = 401;
	let calls = 0;
	const upstream = (async (_url, init) => {
		assert.equal(new Headers(init?.headers).get('cookie'), `ak5_token=${token}`);
		calls++;
		return new Response('{}', { status });
	}) as typeof fetch;
	const handle = createSvelteKitHandle({
		env: () => ({ JWT_SECRET: 'test-secret', PUBLIC_COOKIE_ORIGIN: 'localhost' }),
		allowedJwtType: 'user',
		isProtectedPath: (path) => path === '/private',
		isAuthPage: (path) => path === '/login',
		loggedInHome: () => '/private',
		validateSession: (_event, value) =>
			validateApiSession('https://api.example.test', upstream, value)
	});
	const input = (path: string) =>
		({
			event: {
				url: new URL(path, 'https://app.example.test'),
				request: new Request(new URL(path, 'https://app.example.test'), {
					headers: { cookie: `ak5_token=${token}` }
				}),
				locals: {},
				cookies: { get: () => undefined }
			},
			resolve: async () => new Response('ok')
		}) as unknown as Parameters<Handle>[0];
	for (const path of ['/login', '/private']) {
		const response = await handle(input(path));
		assert.equal(response.status, path === '/login' ? 200 : 303);
		assert.match(response.headers.get('set-cookie') ?? '', /ak5_token=;.*Max-Age=0/);
	}
	status = 503;
	await assert.rejects(
		async () => handle(input('/private')),
		(error: { status?: number }) => error.status === 503
	);
	status = 200;
	assert.equal((await handle(input('/private'))).status, 200);
	assert.equal(calls, 4);
});

test('malformed auth cookies reach login and cannot open protected pages', async () => {
	const handle = createSvelteKitHandle({
		env: () => ({ JWT_SECRET: 'test-secret', PUBLIC_COOKIE_ORIGIN: '' }),
		allowedJwtType: 'user',
		validateSession: async () => true,
		isProtectedPath: (path) => path === '/private'
	});
	for (const cookie of ['ak5_token=%ZZ', 'ak5_token=a.b.%%%', 'ak5_admin_token=%ZZ']) {
		for (const path of ['/login', '/private']) {
			const url = new URL(path, 'https://app.example.com');
			const event = {
				request: new Request(url, { headers: { cookie } }),
				url,
				locals: {},
				cookies: { get: () => undefined }
			} as unknown as Parameters<Handle>[0]['event'];
			const response = await handle({
				event,
				resolve: async () => new Response('ok')
			} as Parameters<Handle>[0]);
			assert.equal(response.status, path === '/login' ? 200 : 303);
		}
	}
});

test('a cookie set by a password action takes precedence over the hook refresh', async (t) => {
	const now = Date.now();
	t.mock.method(Date, 'now', () => now - 40_000);
	const token = await signJwt(
		'test-secret',
		{
			sub: 'u-owner',
			email: 'owner@example.test',
			type: 'user',
			emailConfirmed: true,
			hasPassword: true,
			recentAuthAt: 1,
			sessionVersion: 2
		},
		60
	);
	t.mock.restoreAll();
	let cookieValue = token;
	const handle = createSvelteKitHandle({
		env: () => ({ JWT_SECRET: 'test-secret', PUBLIC_COOKIE_ORIGIN: 'localhost' }),
		allowedJwtType: 'user',
		isProtectedPath: () => true,
		validateSession: async () => true
	});
	const response = await handle({
		event: {
			url: new URL('https://app.example.test/account/password'),
			request: new Request('https://app.example.test/account/password', {
				headers: { cookie: `ak5_token=${token}` }
			}),
			locals: {},
			cookies: { get: (name: string) => (name === 'ak5_token' ? cookieValue : undefined) }
		},
		resolve: async () => {
			cookieValue = 'replacement-from-action';
			return new Response('ok');
		}
	} as unknown as Parameters<Handle>[0]);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('set-cookie'), null);
	assert.equal(response.headers.get('cache-control'), 'no-store');
});
