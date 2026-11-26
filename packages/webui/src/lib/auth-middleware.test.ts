import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RouterContextProvider } from 'react-router';
import { signJwt } from '@ak5/shared';
import { createAuthMiddleware } from './auth-middleware.js';
import { createFrontendWorker } from './frontend-worker.js';
import { requestState, setRequestState } from './request-context.js';

const payload = {
	sub: 'u-owner',
	email: 'owner@example.test',
	type: 'user',
	emailConfirmed: true,
	hasPassword: true,
	recentAuthAt: 1,
	sessionVersion: 3
} as const;
const runAuth = createAuthMiddleware({
	allowedJwtType: 'user',
	isProtectedPath: (path) => path === '/private',
	isAuthPage: (path) => path === '/login',
	loggedInHome: '/private'
});

function request(path: string, init?: RequestInit, api?: typeof fetch) {
	const url = new URL(path, 'https://app.example.test');
	const context = new RouterContextProvider();
	setRequestState(context, {
		JWT_SECRET: 'test-secret',
		PUBLIC_COOKIE_ORIGIN: '',
		PUBLIC_API_URL: 'https://api.example.test',
		API: api && { fetch: api }
	});
	return { context, request: new Request(url, init), url, params: {}, pattern: path };
}

test('guest redirects preserve the destination and never cache the session response', async () => {
	for (const cookie of ['', 'ak5_token=%ZZ', 'ak5_token=a.b.%%%', 'ak5_admin_token=%ZZ']) {
		const args = request('/private?q=one', { headers: { cookie } });
		await assert.rejects(
			async () =>
				runAuth(args, async () => {
					throw new Error('protected handler was reached');
				}),
			(error: Response) =>
				error.status === 303 &&
				error.headers.get('location') === '/login?next=%2Fprivate%3Fq%3Done' &&
				error.headers.get('cache-control') === 'no-store'
		);
	}
});

test('revocation clears the cookie, an upstream failure preserves it', async () => {
	const token = await signJwt('test-secret', payload);
	let status = 401;
	const api: typeof fetch = async (_url, init) => {
		assert.equal(new Headers(init?.headers).get('cookie'), 'ak5_token=' + token);
		return new Response('{}', { status });
	};
	const args = request('/login', { headers: { cookie: 'ak5_token=' + token } }, api);
	const response = await runAuth(args, async () => new Response('ok'));
	assert.ok(response instanceof Response);
	assert.match(response.headers.get('set-cookie') ?? '', /ak5_token=;.*Max-Age=0/);
	status = 503;
	await assert.rejects(
		async () => runAuth(args, async () => new Response('ok')),
		(error: { init: { status: number } }) => error.init.status === 503
	);
});

test('a valid refresh cannot overwrite replacement cookies from an action', async (t) => {
	const now = Date.now();
	t.mock.method(Date, 'now', () => now - 40_000);
	const token = await signJwt('test-secret', payload, 60);
	t.mock.restoreAll();
	const args = request('/private', { headers: { cookie: 'ak5_token=' + token } }, async () =>
		Response.json({})
	);
	const response = await runAuth(args, async () => {
		const { cookies } = requestState(args.context);
		cookies.append('Set-Cookie', 'ak5_token=replacement; Path=/; HttpOnly');
		cookies.append('Set-Cookie', 'other=value; Expires=Tue, 19 Jan 2038 03:14:07 GMT');
		return new Response('ok');
	});
	assert.ok(response instanceof Response);
	assert.deepEqual(response.headers.getSetCookie(), [
		'ak5_token=replacement; Path=/; HttpOnly',
		'other=value; Expires=Tue, 19 Jan 2038 03:14:07 GMT'
	]);
	assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('cross-origin form submissions are rejected before the route action', async () => {
	const worker = createFrontendWorker(async () => {
		throw new Error('cross-origin action was reached');
	});
	const response = await worker.fetch(
		new Request('https://app.example.test/login', {
			method: 'POST',
			body: new URLSearchParams({ email: 'owner@example.test' }),
			headers: { Origin: 'https://other.example.test' }
		}),
		{}
	);
	assert.equal(response.status, 403);
	assert.equal(response.headers.get('cache-control'), 'no-store');
});
