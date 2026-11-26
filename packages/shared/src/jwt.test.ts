import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHmac } from 'node:crypto';

import {
	clearJwtCookie,
	jwtCookie,
	refreshJwt,
	signJwt,
	verifyJwt,
	type IssueJwtInput
} from './jwt.js';

const SECRET = 'test-secret';
const CLAIMS: IssueJwtInput = {
	sub: 'u-abc123',
	email: 'ada@example.com',
	type: 'user',
	emailConfirmed: true,
	hasPassword: true,
	recentAuthAt: Math.floor(Date.now() / 1000)
};

describe('signJwt / verifyJwt', () => {
	it('refresh preserves both session generations', async () => {
		const token = await signJwt(SECRET, {
			...CLAIMS,
			sessionVersion: 4,
			impersonatedBy: 'a-owner',
			impersonatorSessionVersion: 2
		});
		const payload = (await verifyJwt(SECRET, token))!;
		const refreshed = await verifyJwt(SECRET, await refreshJwt(payload, SECRET));
		assert.equal(refreshed?.sessionVersion, 4);
		assert.equal(refreshed?.impersonatorSessionVersion, 2);
	});
	it('round-trips the claims', async () => {
		const token = await signJwt(SECRET, CLAIMS);
		const payload = await verifyJwt(SECRET, token);
		assert.ok(payload);
		assert.equal(payload.sub, CLAIMS.sub);
		assert.equal(payload.type, 'user');
		assert.equal(payload.email, CLAIMS.email);
		assert.ok(payload.iat <= payload.exp);
	});

	it('rejects a token signed with a different secret', async () => {
		const token = await signJwt(SECRET, CLAIMS);
		assert.equal(await verifyJwt('wrong-secret', token), null);
	});

	it('rejects a tampered payload', async () => {
		const token = await signJwt(SECRET, CLAIMS);
		const [h, , s] = token.split('.');
		const forged = Buffer.from(
			JSON.stringify({ ...CLAIMS, sub: 'u-attacker', iat: 0, exp: 9_999_999_999 })
		)
			.toString('base64url')
			.replace(/=+$/, '');
		assert.equal(await verifyJwt(SECRET, `${h}.${forged}.${s}`), null);
	});

	it('rejects an expired token', async () => {
		const token = await signJwt(SECRET, CLAIMS, -10); // already past exp
		assert.equal(await verifyJwt(SECRET, token), null);
	});

	it('rejects a malformed token', async () => {
		assert.equal(await verifyJwt(SECRET, 'not.a.jwt'), null);
		assert.equal(await verifyJwt(SECRET, 'onlyonepart'), null);
	});
});

describe('jwtCookie', () => {
	const base = { name: 'ak5_token', value: 'v' };

	it('localhost: no Domain, not Secure, but HttpOnly + Lax', () => {
		const c = jwtCookie({ ...base, cookieOrigin: 'localhost' });
		assert.doesNotMatch(c, /Domain=/);
		assert.doesNotMatch(c, /Secure/);
		assert.match(c, /HttpOnly/);
		assert.match(c, /SameSite=Lax/);
	});

	it('dotted dev domain: Domain set, not Secure', () => {
		const c = jwtCookie({ ...base, cookieOrigin: '.ak5.localhost' });
		assert.match(c, /Domain=\.ak5\.localhost/);
		assert.doesNotMatch(c, /Secure/);
	});

	it('prod apex: Domain set + Secure', () => {
		const c = jwtCookie({ ...base, cookieOrigin: '.ak5web.com' });
		assert.match(c, /Domain=\.ak5web\.com/);
		assert.match(c, /Secure/);
	});

	it('clearJwtCookie expires the cookie', () => {
		assert.match(clearJwtCookie('ak5_token', '.ak5web.com'), /Max-Age=0/);
	});
});

it('rejects invalid signature encodings without throwing', async () => {
	for (const raw of ['a.b.%%%', 'a.b.☃', 'a.b.a']) assert.equal(await verifyJwt(SECRET, raw), null);
});

it('rejects signed tokens with invalid headers, claims or expiration boundaries', async () => {
	const now = Math.floor(Date.now() / 1000);
	const valid = { ...CLAIMS, iat: now, exp: now + 300 };
	const signed = (payload: unknown, header: unknown = { alg: 'HS256', typ: 'JWT' }) => {
		const data = [header, payload]
			.map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
			.join('.');
		return `${data}.${createHmac('sha256', SECRET).update(data).digest('base64url')}`;
	};
	for (const payload of [
		null,
		[],
		{},
		{ ...valid, exp: now },
		{ ...valid, exp: null },
		{ ...valid, exp: 'forever' },
		{ ...valid, type: 'owner' },
		{ ...valid, sub: '' },
		{ ...valid, recentAuthAt: now + 60 },
		{ ...valid, hasPassword: 'yes' }
	]) {
		assert.equal(await verifyJwt(SECRET, signed(payload)), null);
	}
	for (const header of [null, { alg: 'none' }, { alg: 'HS512', typ: 'JWT' }]) {
		assert.equal(await verifyJwt(SECRET, signed(valid, header)), null);
	}
});
