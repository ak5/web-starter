import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { users } from './schema';
import { createTestDatabase } from './testing';
import { authorizeSync, validateNoteEvents } from '../lib/sync-auth';
import { signJwt } from '../lib/jwt';
import type { Env } from '../types';

test('notes sync checks the real identity, expiry and exact store ownership', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const database = db(local.binding);
	await database.insert(users).values({ id: 'owner', publicId: 'u-owner00000', username: 'owner' });
	await database.insert(users).values({ id: 'mixed', publicId: 'u-OWNER00000', username: 'mixed' });
	const env = { DB: local.binding, JWT_SECRET: 'test-sync-secret' } as Env;
	const claims = {
		sub: 'u-owner00000',
		email: 'owner@example.test',
		type: 'user' as const,
		emailConfirmed: false,
		hasPassword: true,
		recentAuthAt: 1
	};
	const token = await signJwt(env.JWT_SECRET, claims);
	const headers = (value: string) => new Headers({ cookie: `ak5_token=${value}` });
	assert.equal(await authorizeSync(env, headers(token), 'notes-v1-u-owner00000'), true);
	assert.equal(await authorizeSync(env, headers(token), 'notes-v1-u-other00000'), false);
	assert.equal(await authorizeSync(env, new Headers(), 'notes-v1-u-owner00000'), false);
	const mixed = await signJwt(env.JWT_SECRET, { ...claims, sub: 'u-OWNER00000' });
	assert.equal(await authorizeSync(env, headers(mixed), 'notes-v1-u-OWNER00000'), false);
	for (const invalid of [
		'%ZZ',
		'x.x.x',
		await signJwt(env.JWT_SECRET, claims, -1),
		await signJwt(env.JWT_SECRET, { ...claims, type: 'admin' })
	]) {
		assert.equal(await authorizeSync(env, headers(invalid), 'notes-v1-u-owner00000'), false);
	}
	await database.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'owner'));
	assert.equal(await authorizeSync(env, headers(token), 'notes-v1-u-owner00000'), false);
	await database
		.update(users)
		.set({ bannedAt: null, deletedAt: new Date() })
		.where(eq(users.id, 'owner'));
	assert.equal(await authorizeSync(env, headers(token), 'notes-v1-u-owner00000'), false);
});

test('notes sync rejects unknown events, oversized content and malformed arguments without echoing data', () => {
	const note = { id: 'n-11111111-1111-4111-8111-111111111111', text: 'private note', updatedAt: 1 };
	validateNoteEvents([
		{ name: 'v1.NoteSet', args: note, seqNum: 1 },
		{ name: 'v1.NoteDeleted', args: { id: note.id } }
	]);
	for (const value of [
		{ name: 'admin.DeleteUser', args: {} },
		{ name: 'v1.NoteSet', args: { ...note, text: 'x'.repeat(2001) } },
		{ name: 'v1.NoteSet', args: { ...note, text: 'x' + ' '.repeat(2001) } },
		{ name: 'v1.NoteSet', args: { ...note, updatedAt: -1 } },
		{ name: 'v1.NoteSet', args: { ...note, id: 'other' } },
		{ name: 'v1.NoteSet', args: { ...note, owner: 'u-other00000' } },
		{ name: 'v1.NoteDeleted', args: { ...note } }
	])
		assert.throws(() => validateNoteEvents([value]), /^Error: Invalid notes event$/);
});
