import assert from 'node:assert/strict';
import test from 'node:test';
import { accountPasswordAction, forgotPasswordAction, loginAction } from './auth-actions.js';
import { apiErrorMessage } from './api-error.js';

test('password action forwards the replacement session cookie', async () => {
	const cookies = new Headers();
	const result = await accountPasswordAction({
		session: { auth: { hasPassword: true } },
		request: new Request('https://app.example.test/account/password', {
			method: 'POST',
			body: new URLSearchParams({ currentPassword: 'old', newPassword: 'new', password2: 'new' })
		}),
		cookies,
		changePassword: async () =>
			Response.json(
				{ ok: true },
				{ headers: { 'set-cookie': 'ak5_token=replacement; Path=/; HttpOnly' } }
			),
		acceptInvite: async () => {
			throw new Error('unexpected invite');
		},
		setPassword: async () => {
			throw new Error('unexpected first password');
		},
		failures: { changePassword: 'failed', acceptInvite: 'failed', setPassword: 'failed' }
	});
	assert.deepEqual(result, { ok: true });
	assert.deepEqual(cookies.getSetCookie(), ['ak5_token=replacement; Path=/; HttpOnly']);
});

test('recovery failures preserve HTTP status and show a useful message', async () => {
	const result = await forgotPasswordAction({
		request: new Request('https://app.example.test/forgot-password', {
			method: 'POST',
			body: new URLSearchParams({ email: 'owner@example.test' })
		}),
		forgotPassword: async () => Response.json({ error: 'rate_limited' }, { status: 429 })
	});
	assert.equal('init' in result && result.init?.status, 429);
	assert.match('data' in result ? result.data.error : '', /Too many attempts/);
	assert.equal(
		await apiErrorMessage(Response.json({ error: 'invalid_token' }), 'Failed'),
		'That link has expired. Please request a new one.'
	);
	assert.equal(
		await apiErrorMessage(Response.json({ error: 'unknown_code' }), 'Please try again.'),
		'Please try again.'
	);
});

test('sign-in returns to browser-owned MCP consent with a document navigation', async () => {
	const url = new URL('https://app.example.test/login');
	url.searchParams.set('next', '/oauth/authorize?state=fixture');
	await assert.rejects(
		loginAction({
			cookies: new Headers(),
			url,
			request: new Request(url, {
				method: 'POST',
				body: new URLSearchParams({ email: 'owner@example.test' })
			}),
			login: async () => Response.json({ ok: true }),
			successRedirect: '/dashboard'
		}),
		(error: unknown) =>
			error instanceof Response &&
			error.headers.get('Location') === '/oauth/authorize?state=fixture' &&
			error.headers.get('X-Remix-Reload-Document') === 'true'
	);
});

test('redeeming a password link forwards the session and loads a fresh document', async () => {
	const cookies = new Headers();
	await assert.rejects(
		accountPasswordAction({
			session: {},
			request: new Request('https://app.example.test/account/password?t=fixture', {
				method: 'POST',
				body: new URLSearchParams({ token: 'fixture', newPassword: 'new', password2: 'new' })
			}),
			cookies,
			acceptInvite: async () =>
				Response.json(
					{ redirectTo: '/dashboard' },
					{ headers: { 'set-cookie': 'ak5_token=fixture; Path=/' } }
				),
			changePassword: async () => {
				throw new Error('unexpected password change');
			},
			setPassword: async () => {
				throw new Error('unexpected first password');
			},
			failures: { changePassword: 'failed', acceptInvite: 'failed', setPassword: 'failed' }
		}),
		(error: unknown) =>
			error instanceof Response &&
			error.headers.get('Location') === '/dashboard' &&
			error.headers.get('X-Remix-Reload-Document') === 'true'
	);
	assert.deepEqual(cookies.getSetCookie(), ['ak5_token=fixture; Path=/']);
});
