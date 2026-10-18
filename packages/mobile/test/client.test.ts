import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, InputError, createClient, parseItemData } from '../src/client';
import { COOKIE_TOKEN } from '@ak5/shared/cookie';

function fixture(responses: Response[], initial: string | null = null) {
	let saved = initial;
	const requests: { url: string; headers: Headers }[] = [];
	const client = createClient(
		'https://api.example.test',
		{
			get: async () => saved,
			set: async (value) => {
				saved = value;
			},
			clear: async () => {
				saved = null;
			}
		},
		async (input, init) => {
			requests.push({ url: String(input), headers: new Headers(init?.headers) });
			const response = responses.shift();
			assert.ok(response, 'Unexpected request');
			return response;
		}
	);
	return { client, requests, saved: () => saved };
}
const json = (body: unknown, status = 200, cookie?: string) =>
	Response.json(body, {
		status,
		headers: cookie ? { 'set-cookie': `${COOKIE_TOKEN}=${cookie}; HttpOnly; Path=/` } : {}
	});
const user = { sub: 'u-example', emailConfirmed: false };

test('keeps an unconfirmed signup session when verification delivery fails', async () => {
	const f = fixture([json({ ok: true, verificationEmailSent: false }, 200, 'session'), json(user)]);
	const result = await f.client.register('user@example.test', 'password', 'user_name', true);
	assert.deepEqual(result.result, { ok: true, verificationEmailSent: false });
	assert.equal(f.saved(), 'session');
	assert.equal(f.requests[1].headers.get('Cookie'), `${COOKIE_TOKEN}=session`);
});

test('clears rejected restored sessions, but preserves them on temporary failure', async () => {
	const f = fixture(
		[json({ error: 'unavailable' }, 503), json({ error: 'unauthorized' }, 401)],
		'saved'
	);
	await assert.rejects(
		f.client.restore(),
		(e: unknown) => e instanceof ApiError && e.status === 503
	);
	assert.equal(f.saved(), 'saved');
	await assert.rejects(
		f.client.restore(),
		(e: unknown) => e instanceof ApiError && e.status === 401
	);
	assert.equal(f.saved(), null);
});

test('verification replaces the saved session; resend failures remain retryable', async () => {
	const f = fixture(
		[
			json(user),
			json({ error: 'email_delivery_failed' }, 503),
			json({ ok: true }),
			json({ ok: true }, 200, 'verified'),
			json({ ...user, emailConfirmed: true })
		],
		'old'
	);
	await f.client.restore();
	await assert.rejects(f.client.resend(), /email_delivery_failed/);
	assert.equal(f.saved(), 'old');
	await f.client.resend();
	await f.client.verify('123456');
	assert.equal(f.saved(), 'verified');
});

test('uses zero-based pagination and removes local session even if logout fails', async () => {
	const f = fixture(
		[json(user), json({ items: [], pagination: { page: 2 } }), json({ error: 'unavailable' }, 503)],
		'saved'
	);
	await f.client.restore();
	await f.client.list(2);
	assert.equal(new URL(f.requests[1].url).searchParams.get('page'), '2');
	await f.client.logout();
	assert.equal(f.saved(), null);
});

test('rejects login without a session cookie and validates the JSON editor', async () => {
	const f = fixture([json({ ok: true })]);
	await assert.rejects(f.client.login('user@example.test', 'password'), /did not return a session/);
	assert.deepEqual(parseItemData('{"title":"Example"}'), { title: 'Example' });
	for (const value of ['null', '[]', '42', 'invalid'])
		assert.throws(() => parseItemData(value), InputError);
});

test('public recovery uses the same endpoint and response for either account state', async () => {
	const f = fixture([json({ ok: true }), json({ ok: true })]);
	assert.deepEqual(
		await f.client.recover('known@example.test'),
		await f.client.recover('unknown@example.test')
	);
	assert.equal(new URL(f.requests[0].url).pathname, '/auth/forgot-password');
	assert.equal(f.saved(), null);
});

test('loads the native client without browser text codecs or JWT signing code', () => {
	const result = spawnSync(
		process.execPath,
		[
			'--import',
			'tsx',
			'--input-type=module',
			'-e',
			`
 globalThis.TextEncoder = undefined;
 globalThis.TextDecoder = undefined;
 const { createClient } = await import('./src/client.ts');
 createClient('https://api.example.test', { get: async () => null, set: async () => {}, clear: async () => {} });
 `
		],
		{ cwd: new URL('../', import.meta.url), encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
});

test('logout reports a failed secure-storage removal so the user can retry', async () => {
	let saved: string | null = 'session';
	let fail = true;
	const client = createClient(
		'https://api.example.test',
		{
			get: async () => saved,
			set: async (value) => {
				saved = value;
			},
			clear: async () => {
				if (fail) throw new Error('Storage locked');
				saved = null;
			}
		},
		async () => json({ ok: true })
	);
	await client.restore();
	await assert.rejects(client.logout(), /Storage locked/);
	assert.equal(saved, 'session');
	fail = false;
	await client.logout();
	assert.equal(saved, null);
});
