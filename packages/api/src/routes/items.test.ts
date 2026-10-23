import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDatabase } from '../db/testing';
import { COOKIE_TOKEN, publicId, signJwt } from '@ak5/shared';

import { app } from '../app';
import { db as makeDb } from '../db';
import { users } from '../db/schema';
import type { Env } from '../types';

const JWT_SECRET = 'items-e2e-test-secret';

test('items: full CRUD + ownership scoping over HTTP', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const env = { DB: local.binding, JWT_SECRET } as unknown as Env;
	const db = makeDb(local.binding);

	// Two throwaway users: the owner (A) and an unrelated user (B) used to prove
	// ownership scoping. publicId doubles as a guaranteed-unique username/email.
	const pubA = publicId('user');
	const pubB = publicId('user');
	const [rowA, rowB] = await db
		.insert(users)
		.values([
			{ publicId: pubA, username: pubA, email: `${pubA}@e2e.test` },
			{ publicId: pubB, username: pubB, email: `${pubB}@e2e.test` }
		])
		.returning({ id: users.id, publicId: users.publicId });

	const now = Math.floor(Date.now() / 1000);
	const tokenFor = (sub: string) =>
		signJwt(JWT_SECRET, {
			sub,
			email: `${sub}@e2e.test`,
			type: 'user',
			emailConfirmed: true,
			hasPassword: true,
			recentAuthAt: now
		});
	const tokenA = await tokenFor(rowA.publicId);
	const tokenB = await tokenFor(rowB.publicId);

	const call = (method: string, path: string, token?: string, body?: unknown) =>
		app.request(
			path,
			{
				method,
				headers: {
					'content-type': 'application/json',
					...(token ? { cookie: `${COOKIE_TOKEN}=${token}` } : {})
				},
				body: body === undefined ? undefined : JSON.stringify(body)
			},
			env
		);

	// Unauthenticated → 401.
	assert.equal((await call('GET', '/items')).status, 401);

	// Empty list for a fresh user.
	const empty = await call('GET', '/items', tokenA);
	assert.equal(empty.status, 200);
	const emptyBody = (await empty.json()) as { items: unknown[]; pagination: { total: number } };
	assert.deepEqual(emptyBody.items, []);
	assert.equal(emptyBody.pagination.total, 0);

	// Create.
	const created = await call('POST', '/items', tokenA, { data: { text: 'hello' } });
	assert.equal(created.status, 201);
	const item = (await created.json()) as {
		id: string;
		data: { text: string };
		createdAt: string;
		modifiedAt: string;
	};
	assert.ok(item.id.startsWith('i-'), `expected i- prefix, got ${item.id}`);
	assert.equal(item.data.text, 'hello');

	// Read back.
	const fetched = await call('GET', `/items/${item.id}`, tokenA);
	assert.equal(fetched.status, 200);
	assert.equal(((await fetched.json()) as { id: string }).id, item.id);

	// Update replaces `data` and bumps `modifiedAt`.
	const updated = await call('PATCH', `/items/${item.id}`, tokenA, { data: { text: 'updated' } });
	assert.equal(updated.status, 200);
	const updatedItem = (await updated.json()) as { data: { text: string }; modifiedAt: string };
	assert.equal(updatedItem.data.text, 'updated');
	assert.ok(
		Date.parse(updatedItem.modifiedAt) >= Date.parse(item.createdAt),
		'modifiedAt should not predate createdAt'
	);

	// The owner now lists exactly one item.
	const listed = await call('GET', '/items', tokenA);
	assert.equal(((await listed.json()) as { pagination: { total: number } }).pagination.total, 1);

	// Ownership scoping: user B cannot see, edit, or delete A's item, and has an
	// empty list of their own.
	assert.equal((await call('GET', `/items/${item.id}`, tokenB)).status, 404);
	assert.equal((await call('PATCH', `/items/${item.id}`, tokenB, { data: {} })).status, 404);
	assert.equal((await call('DELETE', `/items/${item.id}`, tokenB)).status, 404);
	assert.equal(
		((await (await call('GET', '/items', tokenB)).json()) as { pagination: { total: number } })
			.pagination.total,
		0
	);

	// Validation: a malformed body is rejected.
	assert.equal((await call('POST', '/items', tokenA, { data: 'not-an-object' })).status, 400);

	// Delete, then it is gone.
	assert.equal((await call('DELETE', `/items/${item.id}`, tokenA)).status, 200);
	assert.equal((await call('GET', `/items/${item.id}`, tokenA)).status, 404);
});
