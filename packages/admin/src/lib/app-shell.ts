import { responseJsonBody } from '@ak5/webui';
import { api } from './api';
import type { Viewer } from './types';

type ShellEvent = {
	locals: App.Locals;
	fetch: typeof fetch;
	request: Request;
};

/**
 * Shape the authenticated viewer for global chrome. Calls `/me` so nav-level
 * display fields come from the api worker, not from JWT claims.
 */
export async function loadAppShell(event: ShellEvent) {
	const { locals, fetch, request } = event;
	const auth = locals.auth;

	let me: Record<string, unknown> | null = null;
	if (auth) {
		const r = await api(fetch, request).me.$get();
		if (r.ok) me = await responseJsonBody<Record<string, unknown> | null>(r, null);
	}

	const viewer: Viewer | null = auth
		? {
				publicId: auth.sub,
				username: (me?.username as string) ?? auth.name ?? auth.email.split('@')[0],
				displayName: (me?.displayName as string | null) ?? auth.name ?? null,
				avatar: (me?.avatar as string | null) ?? null,
				email: auth.email,
				emailVerified:
					typeof me?.emailVerified === 'boolean' ? me.emailVerified : auth.emailConfirmed,
				role: auth.type
			}
		: null;

	return {
		auth,
		viewer,
		needGdpr: locals.needGdpr,
		gdpr: locals.gdpr,
		theme: locals.theme,
		prefersColorScheme: locals.prefersColorScheme
	};
}
