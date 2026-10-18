/**
 * Headers that server-side SvelteKit loaders/actions must forward to the API
 * worker when using the Hono RPC client.
 */
export function apiRequestHeaders(request?: Request): Record<string, string> {
	const headers: Record<string, string> = {};
	if (!request) return headers;

	const cookie = request.headers.get('cookie');
	if (cookie) headers.cookie = cookie;

	// Forward the client IP so API rate limits track the real caller, not the
	// SvelteKit worker. Tests inject synthetic IPs via `setExtraHTTPHeaders`.
	const cfIp = request.headers.get('cf-connecting-ip');
	const xff = request.headers.get('x-forwarded-for');
	if (cfIp) headers['cf-connecting-ip'] = cfIp;
	if (xff) headers['x-forwarded-for'] = xff;

	return headers;
}
