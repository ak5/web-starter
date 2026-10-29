import type { PageServerLoad } from './$types';
import { apiLoadJson } from '@ak5/webui';
import { api } from '#lib/api.js';

export const load: PageServerLoad = async ({ fetch, request }) => {
	const r = await api(fetch, request).admin.users.$get();
	const data = await apiLoadJson(r, 'Could not load users. Please retry.');
	return { users: data.users };
};
