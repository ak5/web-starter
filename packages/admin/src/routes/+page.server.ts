import type { PageServerLoad } from './$types';
import { responseJsonBody } from '@ak5/webui';
import { api } from '#lib/api.js';

type AdminUserRow = {
	publicId: string;
	username: string;
	email: string | null;
	role: string;
	statusLabel: string;
};

export const load: PageServerLoad = async ({ fetch, request }) => {
	const r = await api(fetch, request).admin.users.$get();
	const data = r.ok ? await responseJsonBody<{ users: AdminUserRow[] } | null>(r, null) : null;
	return { users: data?.users ?? [] };
};
