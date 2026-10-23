import { env } from 'cloudflare:workers';
import { JWT_SECRET, PUBLIC_COOKIE_ORIGIN } from '$app/env/private';
import { dev } from '$app/env';
import { sequence } from '@sveltejs/kit/hooks';
import { createGdprHandle, createSvelteKitHandle, securityHeadersHandle } from '@ak5/webui';

/**
 * Admin is a pure UI worker. Everything except `/login` requires an admin JWT.
 * All data goes through `#lib/api.js` → the admin-scoped api routes.
 */

const jwtAuth = createSvelteKitHandle({
	env: () => ({ JWT_SECRET, PUBLIC_COOKIE_ORIGIN }),
	allowedJwtType: 'admin',
	isProtectedPath: (path) => !path.startsWith('/login'),
	isAuthPage: (path) => path === '/login',
	requiresEmailConfirmed: () => false,
	requiresPassword: () => false,
	loggedInHome: () => '/',
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
