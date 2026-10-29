/**
 * Admin oversight load: all users' items (read-only), each with its owner.
 * Rendered with the same shared ItemsTable the web app uses.
 */
import type { ServerLoad } from '@sveltejs/kit';
import { apiLoadJson } from '@ak5/webui';
import { api } from './api';

export const loadAdminItems: ServerLoad = async ({ fetch, request }) => {
	const body = await apiLoadJson(
		await api(fetch, request).admin.items.$get(),
		'Could not load items. Please retry.'
	);
	return { items: body.items };
};
