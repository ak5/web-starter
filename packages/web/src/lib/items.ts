/**
 * Load + form actions for the signed-in user's `items` (the example CRUD demo).
 * Server-side throughout so the JWT cookie travels to the api; the route module
 * just re-exports these (keeps the route thin per the split-boundary audit).
 */
import { error, fail } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { apiLoadJson } from '@ak5/webui';
import { api } from './api';

export const loadItems: ServerLoad = async ({ fetch, request }) => {
	const body = await apiLoadJson(
		await api(fetch, request).items.$get(),
		'Could not load items. Please retry.'
	);
	if (!('items' in body)) error(502, 'Could not load items. Please retry.');
	return { items: body.items };
};

export const itemsActions: Actions = {
	create: async ({ fetch, request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { message: 'A title is required.' });
		const res = await api(fetch, request).items.$post({ json: { data: { title } } });
		if (!res.ok) return fail(res.status, { message: 'Could not create the item.' });
		return { created: true };
	},
	delete: async ({ fetch, request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'Missing item id.' });
		const res = await api(fetch, request).items[':id'].$delete({ param: { id } });
		if (!res.ok) return fail(res.status, { message: 'Could not delete the item.' });
		return { deleted: true };
	}
};
