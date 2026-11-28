/**
 * Admin oversight load: all users' items (read-only), each with its owner.
 * Rendered with the same shared ItemsTable the web app uses.
 */
import { redirect } from 'react-router';
import type { ApiRequestEvent } from '@ak5/webui/server';
import { apiLoadJson } from '@ak5/webui/server';
import { api } from './api.server';

export const loadAdminItems = async (event: ApiRequestEvent) => {
	const url = new URL(event.request.url);
	const body = await apiLoadJson(
		await api(event).admin.items.$get({ query: { page: url.searchParams.get('page') ?? '0' } }),
		'Could not load items. Please retry.'
	);
	if (body.pagination.page >= body.pagination.totalPages) {
		url.searchParams.set('page', String(body.pagination.totalPages - 1));
		throw redirect(url.pathname + url.search);
	}
	return { items: body.items, pagination: body.pagination };
};
