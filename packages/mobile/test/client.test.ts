import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, InputError, createClient, parseItemData, type SessionUser } from '../src/client';
import { COOKIE_TOKEN } from '@ak5/shared/cookie';

function fixture(responses: (Response | Error)[], initial: string | null = null) {
	let saved = initial;
	let cached: SessionUser | null = null;
	const requests: { url: string; headers: Headers }[] = [];
	const client = createClient(
		'https://api.example.test',
		{
			get: async () => saved,
			getViewer: async () => cached,
			setViewer: async (value) => {
				cached = value;
			},
			set: async (value) => {
				saved = value;
			},
			clear: async () => {
				saved = null;
				cached = null;
			}
		},
		async (input, init) => {
			requests.push({ url: String(input), headers: new Headers(init?.headers) });
			const response = responses.shift();
			assert.ok(response, 'Unexpected request');
			if (response instanceof Error) throw response;
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
const user: SessionUser = {
	sub: 'u-example',
	emailConfirmed: false,
	email: 'user@example.test',
	name: 'User',
	type: 'user' as const,
	hasPassword: true,
	recentAuthAt: 1,
	impersonatedBy: undefined
};

test('keeps an unconfirmed signup session when verification delivery fails', async () => {
	const f = fixture([json({ ok: true, verificationEmailSent: false }, 200, 'session'), json(user)]);
	const result = await f.client.register('user@example.test', 'password', 'user_name', true);
	assert.deepEqual(result.result, { ok: true, verificationEmailSent: false });
	assert.equal(f.saved(), 'session');
	assert.equal(f.requests[1].headers.get('Cookie'), `${COOKIE_TOKEN}=session`);
});

test('rejects validator responses before requesting or caching a signup viewer', async () => {
	const f = fixture([json({ success: false, error: { issues: [] } }, 400)], 'old-session');
	await assert.rejects(
		f.client.register('invalid', 'password', 'user_name', true),
		(error: unknown) => error instanceof ApiError && error.status === 400
	);
	assert.equal(f.saved(), null);
	assert.equal(f.requests.length, 1);
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
			getViewer: async () => null,
			setViewer: async () => {},
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

test('offline restore uses the cached viewer, but an expired session clears it', async () => {
	let cached: SessionUser | null = user;
	let token: string | null = 'saved';
	let offline = true;
	const client = createClient(
		'https://api.example.test',
		{
			get: async () => token,
			set: async (value) => {
				token = value;
			},
			getViewer: async () => cached,
			setViewer: async (value) => {
				cached = value;
			},
			clear: async () => {
				token = null;
				cached = null;
			}
		},
		async () => {
			if (offline) throw new Error('fetch failed: Network connection lost');
			return json({ error: 'unauthorized' }, 401);
		}
	);
	assert.deepEqual(await client.restore(), user);
	assert.equal(client.sessionCookie(), `${COOKIE_TOKEN}=saved`);
	offline = false;
	await assert.rejects(client.restore(), ApiError);
	assert.equal(cached, null);
	assert.equal(client.sessionCookie(), '');
});

test('a disabled account cannot retain an offline viewer after the server rejects restore', async () => {
	const f = fixture([json(user), json({ error: 'user_disabled' }, 403)], 'saved');
	await f.client.restore();
	await assert.rejects(f.client.restore(), ApiError);
	assert.equal(f.saved(), null);
	assert.equal(f.client.sessionCookie(), '');
});

test('offline restore does not hide a secure-storage failure behind a cached viewer', async () => {
	const client = createClient(
		'https://api.example.test',
		{
			get: async () => 'saved',
			set: async () => {},
			clear: async () => {},
			getViewer: async () => user,
			setViewer: async () => {
				throw new TypeError('Storage locked');
			}
		},
		async () => json(user)
	);
	await assert.rejects(client.restore(), /Storage locked/);
});

test('refreshing a session keeps offline access, while a new sign-in clears the previous viewer', async () => {
	const f = fixture(
		[
			json(user),
			json({ items: [], pagination: {} }, 200, 'renewed'),
			new TypeError('offline'),
			json({ error: 'invalid_credentials' }, 401),
			new TypeError('offline')
		],
		'saved'
	);
	await f.client.restore();
	await f.client.list();
	assert.equal((await f.client.restore())?.sub, user.sub);
	assert.equal(f.saved(), 'renewed');
	await assert.rejects(f.client.login('other@example.test', 'wrong'), ApiError);
	assert.equal(await f.client.restore(), null);
});
