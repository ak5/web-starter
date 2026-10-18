import { env } from 'cloudflare:workers';
import { JWT_SECRET, PUBLIC_COOKIE_ORIGIN } from '$app/env/private';
import { dev } from '$app/env';
import { sequence } from '@sveltejs/kit/hooks';
import {
	createGdprHandle,
	createSvelteKitHandle,
	matchesPathPrefix,
	securityHeadersHandle
} from '@ak5/webui';

/**
 * Web is a pure UI worker — no DB, no R2, no KV. Its only server-side concerns:
 *   1. verify the JWT cookie locally (route guards skip an api round-trip)
 *   2. theme + GDPR preferences
 *   3. security headers
 *
 * All data fetching/mutations go through `#lib/api.js` → the api worker.
 */

const PROTECTED_PREFIXES = ['/dashboard', '/account'];
const AUTH_PAGE_PATHS = ['/login', '/register'];

const jwtAuth = createSvelteKitHandle({
	env: () => ({ JWT_SECRET, PUBLIC_COOKIE_ORIGIN }),
	allowedJwtType: 'user',
	isProtectedPath: (path) => matchesPathPrefix(path, PROTECTED_PREFIXES),
	isAuthPage: (path) => AUTH_PAGE_PATHS.includes(path),
	requiresEmailConfirmed: () => false,
	requiresPassword: () => false,
	loggedInHome: () => '/dashboard',
	attachLocals: (event, payload, token) => {
		event.locals.apiFetch = dev ? undefined : (env.API?.fetch.bind(env.API) as typeof fetch);
		event.locals.auth = payload;
		event.locals.jwt = token;
	}
});

const gdpr = createGdprHandle({ force: dev });

export const handle = sequence(jwtAuth, gdpr, securityHeadersHandle);

export const handleError: import('@sveltejs/kit/hooks').HandleServerError = ({
	kind,
	error,
	event
}) => {
	if (kind === 'unknown') console.error('[handleError]', event.url.pathname, error);
};
