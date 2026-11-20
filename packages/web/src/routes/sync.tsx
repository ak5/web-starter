import { apiBaseUrl, requestState } from '@ak5/webui/server';
import type { Route } from './+types/sync';

export const loader = methodNotAllowed;

export async function action({ request, url, context }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed();
	const { env, fetch, session } = requestState(context);
	if (!session.auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
	const target = new URL('/sync', apiBaseUrl(env));
	target.search = url.search;
	const response = await fetch(target, {
		method: 'POST',
		headers: {
			'content-type': request.headers.get('content-type') ?? 'application/json',
			cookie: request.headers.get('cookie') ?? ''
		},
		body: await request.arrayBuffer()
	});
	return new Response(response.body, {
		status: response.status,
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/json',
			'cache-control': 'no-store'
		}
	});
}

function methodNotAllowed() {
	return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
