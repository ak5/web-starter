import { hc } from 'hono/client';
import type { Hono } from 'hono';
import { apiRequestHeaders } from './api-headers.js';
import { COOKIE_TOKEN } from '@ak5/shared';
import { error } from '@sveltejs/kit';

// Hono's `hc` helper constrains clients as `Hono<any, any, any>` so apps with
// custom environments remain assignable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HonoApi = Hono<any, any, any>;

export type ApiClient<T extends HonoApi> = ReturnType<typeof hc<T>>;

export type ApiRequestEvent = {
	fetch: typeof globalThis.fetch;
	request: Request;
};

/** Revocation lives in the API database; an outage must not clear a valid cookie. */
export async function validateApiSession(baseUrl: string, fetchImpl: typeof fetch, token: string) {
	const response = await fetchImpl(new URL('/auth/me', baseUrl), {
		headers: { cookie: `${COOKIE_TOKEN}=${token}` },
		cache: 'no-store'
	});
	if (response.status === 401 || response.status === 403) return false;
	if (!response.ok) error(503, 'Unable to check your session. Please try again.');
	return true;
}

export function createApiClient<T extends HonoApi>(
	baseUrl: string,
	fetchImpl: typeof fetch = fetch,
	request?: Request
): ApiClient<T> {
	return hc<T>(baseUrl, {
		fetch: fetchImpl,
		headers: apiRequestHeaders(request),
		init: { credentials: 'include' }
	});
}
