/**
 * Admin oversight load: all users' items (read-only), each with its owner.
 * Rendered with the same shared ItemsTable the web app uses.
 */
import type { ServerLoad } from '@sveltejs/kit';
import { api } from './api';

type AdminItemRow = {
	id: string;
	data: Record<string, unknown>;
	createdAt: string;
	owner: string | null;
};

export const loadAdminItems: ServerLoad = async ({ fetch, request }) => {
	try {
		const res = await api(fetch, request).admin.items.$get();
		if (!res.ok) return { items: [] };
		const body = (await res.json()) as { items?: AdminItemRow[] };
		return { items: body.items ?? [] };
	} catch {
		return { items: [] };
	}
};
