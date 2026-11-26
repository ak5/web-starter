import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptToken, decryptToken } from './crypto';

test('OAuth encryption requires an exact 256-bit hex key and authenticates ciphertext', async () => {
	const key = 'a1'.repeat(32);
	const encrypted = await encryptToken('private refresh token', key);
	assert.equal(await decryptToken(encrypted, key), 'private refresh token');
	for (const invalid of [
		'g'.repeat(64),
		'a'.repeat(63),
		'a'.repeat(32),
		'a'.repeat(48),
		`${key} `
	]) {
		await assert.rejects(
			encryptToken('private refresh token', invalid),
			/64 hexadecimal characters/
		);
		await assert.rejects(decryptToken(encrypted, invalid), /64 hexadecimal characters/);
	}
	await assert.rejects(decryptToken(encrypted, 'b2'.repeat(32)));
	const tampered = Buffer.from(encrypted, 'base64');
	tampered[tampered.length - 1] ^= 1;
	await assert.rejects(decryptToken(tampered.toString('base64'), key));
});
