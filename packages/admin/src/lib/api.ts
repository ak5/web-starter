/**
 * Type-safe Hono RPC client for talking to `@ak5/api` as the **admin** persona.
 *
 * `adminApi` exposes only the admin-scoped routes — calling a web-only route
 * from here is a compile error.
 */
import { PUBLIC_API_URL } from '$app/env/public';
import { getRequestEvent } from '$app/server';
import type { AdminApiType } from '@ak5/api';
import { createApiClient, type ApiClient } from '@ak5/webui';

export type AdminApiClient = ApiClient<AdminApiType>;

export function apiBaseUrl(): string {
	const baseUrl = PUBLIC_API_URL;
	if (!baseUrl) throw new Error('PUBLIC_API_URL is not configured');
	return baseUrl;
}

// On Cloudflare a Worker can't fetch another Worker on the same account over the
// public internet (error 1042). When the API service binding is present (see
// wrangler.jsonc `services`), route server-side calls straight to the api Worker
// through it; in the browser / dev, fall back to the provided fetch.
function serverFetch(fallback: typeof fetch): typeof fetch {
	try {
		const binding = getRequestEvent().locals.apiFetch;
		if (binding) return binding;
	} catch {
		// Not inside a server request (browser) — use the provided fetch.
	}
	return fallback;
}

export function api(fetchImpl: typeof fetch = fetch, request?: Request): AdminApiClient {
	return createApiClient<AdminApiType>(apiBaseUrl(), serverFetch(fetchImpl), request);
}
