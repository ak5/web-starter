/**
 * Load + form actions for the signed-in user's `items` (the example CRUD demo).
 * Server-side throughout so the JWT cookie travels to the api; the route module
 * just re-exports these (keeps the route thin per the split-boundary audit).
 */
import { DELETE_CONFIRMATION } from '@ak5/webui';
import { data, redirect } from 'react-router';
import type { ApiRequestEvent } from '@ak5/webui/server';
import { apiLoadJson } from '@ak5/webui/server';
import { api } from './api.server';

export const loadItems = async (event: ApiRequestEvent) => {
	const url = new URL(event.request.url);
	const body = await apiLoadJson(
		await api(event).items.$get({ query: { page: url.searchParams.get('page') ?? '0' } }),
		'Could not load items. Please retry.'
	);
	if (!('items' in body)) throw data('Could not load items. Please retry.', { status: 502 });
	if (body.pagination.page >= body.pagination.totalPages) {
		url.searchParams.set('page', String(body.pagination.totalPages - 1));
		throw redirect('/items' + url.search);
	}
	return { items: body.items, pagination: body.pagination };
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
		if (form.get('confirmation') !== DELETE_CONFIRMATION)
			return data({ message: 'Type DELETE to confirm.' }, { status: 400 });
		const id = String(form.get('id') ?? '');
		if (!id) return data({ message: 'Missing item id.' }, { status: 400 });
		const res = await api(event).items[':id'].$delete({ param: { id } });
		if (!res.ok) return data({ message: 'Could not delete the item.' }, { status: res.status });
		return { deletedId: id };
	}
};
