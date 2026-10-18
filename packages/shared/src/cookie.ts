/** Cookie name for the user JWT. Shared across web/api workers. */
export const COOKIE_TOKEN = 'ak5_token';
/**
 * Cookie name for the admin's own JWT preserved during impersonation. Set
 * separately so admins can return to their own session.
 */
export const COOKIE_ADMIN_TOKEN = 'ak5_admin_token';

/**
 * Cookie helpers for cross-subdomain auth. Used by both the web apps and the
 * API so the cookie domain/secure rules stay in sync.
 */

export interface CookieOriginShape {
	/** Value for the cookie `Domain` attribute, or undefined to omit it. */
	domain?: string;
	/** Whether to set `Secure` on the cookie. */
	secure: boolean;
}

/**
 * Derive cookie domain + secure flag from a request origin. Shapes:
 *  - unset (`undefined`) → no Domain, no Secure (dev fallback)
 *  - explicit empty string → no Domain, Secure on (host-only cookies on an HTTPS
 *    host that can't share a domain, e.g. `*.workers.dev` staging on the PSL)
 *  - `localhost` or bare IPv4 (e.g. tailnet IP) → no Domain, no Secure
 *  - dotted dev domain (e.g. `.ak5.localhost`) → Domain set, no Secure
 *  - prod (e.g. `.ak5web.com`) → Domain set, Secure on
 */
export function parseOrigin(origin: string | undefined): CookieOriginShape {
	if (origin === undefined) return { secure: false };
	if (origin === '') return { secure: true };
	if (origin === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(origin)) {
		return { secure: false };
	}
	if (origin.startsWith('.localhost') || origin.endsWith('.localhost')) {
		return { domain: origin, secure: false };
	}
	return { domain: origin, secure: true };
}

/** Extract a named cookie value from a raw Cookie header. */
export function parseCookie(
	cookieHeader: string | null | undefined,
	name: string
): string | undefined {
	if (!cookieHeader) return undefined;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
