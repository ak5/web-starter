/**
 * Admin oversight load: all users' items (read-only), each with its owner.
 * Rendered with the same shared ItemsTable the web app uses.
 */
import type { ApiRequestEvent } from '@ak5/webui/server';
import { apiLoadJson } from '@ak5/webui/server';
import { api } from './api.server';

export const loadAdminItems = async (event: ApiRequestEvent) => {
	const body = await apiLoadJson(
		await api(event).admin.items.$get(),
		'Could not load items. Please retry.'
	);
	return { items: body.items };
};
