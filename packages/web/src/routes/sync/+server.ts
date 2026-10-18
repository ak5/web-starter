import type { RequestHandler } from './$types';
import { apiBaseUrl } from '#lib/api.js';

/** Same-origin bridge keeps the session HttpOnly and out of LiveStore URL payloads. */
export const POST: RequestHandler = async ({ request, url, locals, fetch }) => {
	if (!locals.auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
	const target = new URL('/sync', apiBaseUrl());
	target.search = url.search;
	const headers = new Headers({
		'content-type': request.headers.get('content-type') ?? 'application/json',
		cookie: request.headers.get('cookie') ?? ''
	});
	const upstream = new Request(target, {
		method: 'POST',
		headers,
		body: await request.arrayBuffer()
	});
	const response = await (locals.apiFetch ?? fetch)(upstream);
	return new Response(response.body, {
		status: response.status,
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/json',
			'cache-control': 'no-store'
		}
	});
};
