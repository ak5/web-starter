/**
 * Type-safe Hono RPC client for talking to `@ak5/api`.
 *
 * `webApi` exposes only the routes scoped to the web frontend — calling an
 * admin-only route from here is a compile error.
 *
 * Server-side (loaders, actions): pass the request so the JWT cookie + client
 * IP travel with the upstream call. Browser-side callers use credentials:
 * include so the cookie crosses the api subdomain.
 */
import { PUBLIC_API_URL } from '$app/env/public';
import { getRequestEvent } from '$app/server';
import type { WebApiType } from '@ak5/api';
import { createApiClient, type ApiClient } from '@ak5/webui';

export type WebApiClient = ApiClient<WebApiType>;

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

export function api(fetchImpl: typeof fetch = fetch, request?: Request): WebApiClient {
	return createApiClient<WebApiType>(apiBaseUrl(), serverFetch(fetchImpl), request);
}
