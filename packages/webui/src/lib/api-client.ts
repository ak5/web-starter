import { hc } from 'hono/client';
import type { Hono } from 'hono';
import { apiRequestHeaders } from './api-headers.js';

// Hono's `hc` helper constrains clients as `Hono<any, any, any>` so apps with
// custom environments remain assignable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HonoApi = Hono<any, any, any>;

export type ApiClient<T extends HonoApi> = ReturnType<typeof hc<T>>;

export type ApiRequestEvent = {
	fetch: typeof globalThis.fetch;
	request: Request;
};

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
