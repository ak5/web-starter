import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCookie, parseOrigin } from './cookie.js';

describe('parseOrigin', () => {
	it('localhost → no Domain, not Secure', () => {
		assert.deepEqual(parseOrigin('localhost'), { secure: false });
	});

	it('bare IPv4 (tailnet) → no Domain, not Secure', () => {
		assert.deepEqual(parseOrigin('100.64.0.1'), { secure: false });
	});

	it('dotted dev domain → Domain set, not Secure', () => {
		assert.deepEqual(parseOrigin('.ak5.localhost'), {
			domain: '.ak5.localhost',
			secure: false
		});
	});

	it('prod apex → Domain set + Secure', () => {
		assert.deepEqual(parseOrigin('.ak5web.com'), {
			domain: '.ak5web.com',
			secure: true
		});
	});

	it('undefined → not Secure, no Domain', () => {
		assert.deepEqual(parseOrigin(undefined), { secure: false });
	});

	it('empty string → Secure, no Domain (host-only, e.g. workers.dev staging)', () => {
		assert.deepEqual(parseOrigin(''), { secure: true });
	});
});

describe('parseCookie', () => {
	it('extracts a named cookie', () => {
		assert.equal(parseCookie('a=1; ak5_token=xyz; b=2', 'ak5_token'), 'xyz');
	});

	it('returns undefined when absent or empty header', () => {
		assert.equal(parseCookie('a=1; b=2', 'ak5_token'), undefined);
		assert.equal(parseCookie(null, 'ak5_token'), undefined);
		assert.equal(parseCookie('', 'ak5_token'), undefined);
	});

	it('URL-decodes the value', () => {
		assert.equal(parseCookie('t=a%20b', 't'), 'a b');
	});

	it('does not match a name that is only a substring', () => {
		assert.equal(parseCookie('xak5_token=nope', 'ak5_token'), undefined);
	});
});
