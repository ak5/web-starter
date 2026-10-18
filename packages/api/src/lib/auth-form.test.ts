import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loginSchema, registerSchema } from './auth-form';

const valid = {
	email: 'ada@example.com',
	password: 'password1234',
	username: 'ada_lovelace',
	legalAcceptance: true as const
};

describe('registerSchema', () => {
	it('accepts a valid registration', () => {
		assert.equal(registerSchema.safeParse(valid).success, true);
	});

	it('normalises the email (trim + lowercase)', () => {
		const parsed = registerSchema.parse({ ...valid, email: '  Ada@Example.COM ' });
		assert.equal(parsed.email, 'ada@example.com');
	});

	it('makes legalAcceptance optional but rejects an explicit false', () => {
		const { legalAcceptance, ...withoutAcceptance } = valid;
		void legalAcceptance;
		assert.equal(registerSchema.safeParse(withoutAcceptance).success, true);
		assert.equal(registerSchema.safeParse({ ...valid, legalAcceptance: false }).success, false);
	});

	it('enforces username length (5–20) and charset', () => {
		assert.equal(registerSchema.safeParse({ ...valid, username: 'abcd' }).success, false); // 4
		assert.equal(registerSchema.safeParse({ ...valid, username: 'abcde' }).success, true); // 5
		assert.equal(registerSchema.safeParse({ ...valid, username: 'a'.repeat(20) }).success, true);
		assert.equal(registerSchema.safeParse({ ...valid, username: 'a'.repeat(21) }).success, false);
		assert.equal(registerSchema.safeParse({ ...valid, username: 'has space' }).success, false);
		assert.equal(registerSchema.safeParse({ ...valid, username: 'dash-no' }).success, false);
	});

	it('enforces password minimum length (8)', () => {
		assert.equal(registerSchema.safeParse({ ...valid, password: '1234567' }).success, false);
		assert.equal(registerSchema.safeParse({ ...valid, password: '12345678' }).success, true);
	});

	it('rejects a malformed email', () => {
		assert.equal(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success, false);
	});
});

describe('loginSchema', () => {
	it('accepts email + password', () => {
		assert.equal(
			loginSchema.safeParse({ email: valid.email, password: valid.password }).success,
			true
		);
	});

	it('requires both fields', () => {
		assert.equal(loginSchema.safeParse({ email: valid.email }).success, false);
		assert.equal(loginSchema.safeParse({ password: valid.password }).success, false);
	});
});
