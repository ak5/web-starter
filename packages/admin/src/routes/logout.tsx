import { logoutToHome } from '../lib/logout.server';
import type { Route } from './+types/logout';

export const loader = methodNotAllowed;

export function action(event: Route.ActionArgs) {
	return event.request.method === 'POST' ? logoutToHome(event) : methodNotAllowed();
}

function methodNotAllowed() {
	return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
