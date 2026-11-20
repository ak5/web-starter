/**
 * Load + form actions for the signed-in user's `items` (the example CRUD demo).
 * Server-side throughout so the JWT cookie travels to the api; the route module
 * just re-exports these (keeps the route thin per the split-boundary audit).
 */
import { data } from 'react-router';
import type { ApiRequestEvent } from '@ak5/webui/server';
import { apiLoadJson } from '@ak5/webui/server';
import { api } from './api.server';

export const loadItems = async (event: ApiRequestEvent) => {
	const body = await apiLoadJson(
		await api(event).items.$get(),
		'Could not load items. Please retry.'
	);
	if (!('items' in body)) throw data('Could not load items. Please retry.', { status: 502 });
	return { items: body.items };
};

export const itemsActions = {
	create: async (event: ApiRequestEvent, form: FormData) => {
		const title = String(form.get('title') ?? '').trim();
		if (!title) return data({ message: 'A title is required.' }, { status: 400 });
		const res = await api(event).items.$post({ json: { data: { title } } });
		if (!res.ok) return data({ message: 'Could not create the item.' }, { status: res.status });
		return { created: true };
	},
	delete: async (event: ApiRequestEvent, form: FormData) => {
		const id = String(form.get('id') ?? '');
		if (!id) return data({ message: 'Missing item id.' }, { status: 400 });
		const res = await api(event).items[':id'].$delete({ param: { id } });
		if (!res.ok) return data({ message: 'Could not delete the item.' }, { status: res.status });
		return { deleted: true };
	}
};
