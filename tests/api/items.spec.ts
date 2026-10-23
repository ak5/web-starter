import { test, expect } from '@playwright/test';

import { newApiContext, registerUser } from '../helpers/api';

test.describe('items', () => {
	test('unauthenticated requests are rejected', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		expect((await api.get('/items')).status()).toBe(401);
		await api.dispose();
	});

	test('full CRUD lifecycle', async ({ playwright }) => {
		const api = await newApiContext(playwright);
		await registerUser(api);

		// Empty list.
		const empty = await api.get('/items');
		expect(empty.status()).toBe(200);
		const emptyBody = await empty.json();
		expect(emptyBody.items).toEqual([]);
		expect(emptyBody.pagination.total).toBe(0);

		// Create.
		const created = await api.post('/items', { data: { data: { text: 'hello' } } });
		expect(created.status()).toBe(201);
		const item = await created.json();
		expect(item.id).toMatch(/^i-/);
		expect(item.data.text).toBe('hello');

		// Read back.
		const fetched = await api.get(`/items/${item.id}`);
		expect(fetched.status()).toBe(200);
		expect((await fetched.json()).id).toBe(item.id);

		// Update replaces `data` and bumps `modifiedAt`.
		const updated = await api.patch(`/items/${item.id}`, {
			data: { data: { text: 'updated' } }
		});
		expect(updated.status()).toBe(200);
		const updatedItem = await updated.json();
		expect(updatedItem.data.text).toBe('updated');
		expect(Date.parse(updatedItem.modifiedAt)).toBeGreaterThanOrEqual(Date.parse(item.createdAt));

		// The owner now lists exactly one item.
		const listed = await api.get('/items');
		expect((await listed.json()).pagination.total).toBe(1);

		// Validation: a malformed body is rejected.
		expect((await api.post('/items', { data: { data: 'nope' } })).status()).toBe(400);

		// Delete, then it is gone.
		expect((await api.delete(`/items/${item.id}`)).status()).toBe(200);
		expect((await api.get(`/items/${item.id}`)).status()).toBe(404);
		await api.dispose();
	});

	test('items are scoped to their owner', async ({ playwright }) => {
		const owner = await newApiContext(playwright);
		await registerUser(owner);
		const created = await owner.post('/items', {
			data: { data: { text: 'secret' } }
		});
		const item = await created.json();

		const other = await newApiContext(playwright);
		await registerUser(other);

		// The other user can't see, edit, or delete it, and has an empty list.
		expect((await other.get(`/items/${item.id}`)).status()).toBe(404);
		expect((await other.patch(`/items/${item.id}`, { data: { data: {} } })).status()).toBe(404);
		expect((await other.delete(`/items/${item.id}`)).status()).toBe(404);
		expect((await (await other.get('/items')).json()).pagination.total).toBe(0);

		await owner.dispose();
		await other.dispose();
	});
});
