import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Handle } from '@sveltejs/kit/hooks';
import { createSvelteKitHandle } from './sveltekit-handle.js';

test('auth hook reads app runtime variables without a platform object', async () => {
	const env: { JWT_SECRET?: string; PUBLIC_COOKIE_ORIGIN?: string } = {
		JWT_SECRET: 'test-secret',
		PUBLIC_COOKIE_ORIGIN: ''
	};
	const handle = createSvelteKitHandle({
		env: () => env,
		allowedJwtType: 'user',
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
