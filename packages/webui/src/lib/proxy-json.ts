import type { Cookies } from '@sveltejs/kit';
import { forwardSetCookie } from './forward-cookie.js';

type JsonResponseLike = {
	headers: Headers;
	json(): Promise<unknown>;
	status: number;
};

export async function requestJsonBody<T = unknown>(request: Request) {
	return (await request.json().catch(() => null)) as T;
}

export async function responseJsonBody<T = unknown>(
	res: { json(): Promise<unknown> },
	fallback: T
) {
	return (await res.json().catch(() => fallback)) as T;
}

/**
 * Convert a Hono API JSON response into a SvelteKit JSON response while
 * preserving the upstream status code.
 */
export async function proxyJson(res: JsonResponseLike, cookies?: Cookies) {
	const body = await responseJsonBody(res, {});
	if (cookies) forwardSetCookie(res, cookies);
	return Response.json(body, { status: res.status });
}
