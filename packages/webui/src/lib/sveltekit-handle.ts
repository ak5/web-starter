import type { Handle } from '@sveltejs/kit/hooks';
import {
	COOKIE_ADMIN_TOKEN,
	COOKIE_TOKEN,
	clearJwtCookie,
	jwtCookie,
	parseCookie,
	refreshJwt,
	shouldRefreshJwt,
	verifyJwt,
	type JwtType,
	type JwtPayload
} from '@ak5/shared';

/**
 * Configuration for `createSvelteKitHandle`. Each app (web, admin) calls
 * `createSvelteKitHandle({...})` from its own `hooks.server.ts` and supplies
 * the rules that govern that app's auth boundary.
 *
 * The factory enforces the rules in this order:
 *   1. The cookie's JWT must verify and `payload.type === allowedJwtType`.
 *      Anything else clears the cookie and treats the request as unauthenticated.
 *   2. Valid long-lived JWTs are refreshed using the same threshold as the api.
 *   3. If `isProtectedPath(pathname)` returns true and there is no user, the
 *      handler redirects to `/login` (preserving `?next=`).
 *   4. If `requiresEmailConfirmed(pathname)` returns true and the user has
 *      `emailConfirmed === false`, redirect to `/account/verify`.
 *   5. If `requiresPassword(pathname)` returns true and the user has
 *      `hasPassword === false`, redirect to `/account/password`.
 *   6. If the request hits an auth page (`isAuthPage(pathname)`) while logged
 *      in, redirect to `loggedInHome(user)`.
 *
 * The hook pattern: auth cookie parsing, JWT verification,
 * refresh, theme injection, and no-store headers live in `@ak5/webui`; each
 * SvelteKit app only supplies its route predicates.
 */
export interface CreateHandleConfig {
	env: () => { JWT_SECRET?: string; PUBLIC_COOKIE_ORIGIN?: string };
	/** Which JWT `type` claim this app accepts. Mismatches are rejected. */
	allowedJwtType: JwtType;

	/** Cookie name to read/write the JWT from. Defaults to `ak5_token`. */
	cookieName?: string;

	/** Predicates controlling routing rules. */
	isProtectedPath: (pathname: string) => boolean;
	requiresEmailConfirmed?: (pathname: string) => boolean;
	requiresPassword?: (pathname: string) => boolean;
	passwordPath?: string;
	isAuthPage?: (pathname: string) => boolean;

	/** Where to send already-logged-in users who hit an auth page. */
	loggedInHome?: (payload: JwtPayload) => string;

	/** Optional hook to attach extra data to `event.locals` before resolve. */
	attachLocals?: (
		event: Parameters<Handle>[0]['event'],
		payload: JwtPayload | null,
		token: string | null
	) => void | Promise<void>;
}

export type ThemeClass = '' | 'dark';
export type PreferredColorScheme = 'light' | 'dark' | null;
export type GdprLocals = {
	gdpr: number;
	needGdpr: boolean;
};

function getSecret(env: ReturnType<CreateHandleConfig['env']>): string {
	const secret = env.JWT_SECRET;
	if (!secret) throw new Error('JWT_SECRET is not configured');
	return secret;
}

function getCookieOrigin(env: ReturnType<CreateHandleConfig['env']>): string {
	const origin = env.PUBLIC_COOKIE_ORIGIN;
	if (origin == null) throw new Error('PUBLIC_COOKIE_ORIGIN is not configured');
	return origin;
}

function getTheme(event: Parameters<Handle>[0]['event']): ThemeClass {
	const themeCookie = event.cookies.get('theme');
	if (themeCookie === 'dark') return 'dark';
	if (themeCookie === 'light') return '';
	return event.request.headers.get('Sec-CH-Prefers-Color-Scheme') === 'dark' ? 'dark' : '';
}

function withTheme(event: Parameters<Handle>[0]['event']) {
	return {
		transformPageChunk: ({ html }: { html: string }) => html.replace('%theme%', getTheme(event))
	};
}

/**
 * Build the SvelteKit `handle` for one of our SvelteKit apps. Used by both
 * `@ak5/web` and `@ak5/admin` so the auth-gating logic is identical and the
 * `allowedJwtType` is the only knob.
 */
export function createSvelteKitHandle(config: CreateHandleConfig): Handle {
	const cookieName = config.cookieName ?? COOKIE_TOKEN;

	return async ({ event, resolve }) => {
		const cookieHeader = event.request.headers.get('cookie');
		const raw = parseCookie(cookieHeader, cookieName);
		const env = config.env();
		const secret = getSecret(env);
		const cookieOrigin = getCookieOrigin(env);
		const prefersColorScheme = event.request.headers.get(
			'Sec-CH-Prefers-Color-Scheme'
		) as PreferredColorScheme;
		(event.locals as { prefersColorScheme?: PreferredColorScheme; theme?: ThemeClass }).theme =
			getTheme(event);
		(
			event.locals as { prefersColorScheme?: PreferredColorScheme; theme?: ThemeClass }
		).prefersColorScheme = prefersColorScheme;
		let payload: JwtPayload | null = null;
		let activeToken = raw ?? null;

		if (raw) {
			payload = await verifyJwt(secret, raw);
			if (!payload || payload.type !== config.allowedJwtType) {
				// Wrong type or invalid — clear the cookie so the user lands at /login cleanly.
				activeToken = null;
				payload = null;
			} else if (shouldRefreshJwt(payload)) {
				activeToken = await refreshJwt(payload, secret);
			}
		}

		if (!payload && cookieName === COOKIE_TOKEN) {
			const adminToken = parseCookie(cookieHeader, COOKIE_ADMIN_TOKEN);
			if (adminToken) {
				const adminPayload = await verifyJwt(secret, adminToken);
				if (adminPayload?.type === config.allowedJwtType) {
					payload = adminPayload;
					activeToken = adminToken;
				}
			}
		}

		await config.attachLocals?.(event, payload, payload ? activeToken : null);

		const { pathname, search } = event.url;
		const applyAuthCookies = (response: Response) => {
			if (raw && !payload) {
				response.headers.append('Set-Cookie', clearJwtCookie(cookieName, cookieOrigin));
			}
			if (payload && activeToken && activeToken !== raw) {
				response.headers.append(
					'Set-Cookie',
					jwtCookie({ name: cookieName, value: activeToken, cookieOrigin })
				);
				if (
					cookieName === COOKIE_TOKEN &&
					activeToken !== raw &&
					parseCookie(cookieHeader, COOKIE_ADMIN_TOKEN) === activeToken
				) {
					response.headers.append('Set-Cookie', clearJwtCookie(COOKIE_ADMIN_TOKEN, cookieOrigin));
				}
			}
			if (raw || config.isProtectedPath(pathname) || config.isAuthPage?.(pathname)) {
				response.headers.set('Cache-Control', 'no-store');
			}
			return response;
		};
		// Build the redirect with `new Response` (mutable headers) rather than
		// `Response.redirect` — the latter returns immutable headers, so appending
		// Set-Cookie / Cache-Control below throws "Can't modify immutable headers"
		// on the Cloudflare Workers runtime (Node's dev runtime is more permissive).
		const redirectWithAuthCookies = (location: string, status = 303) =>
			applyAuthCookies(
				new Response(null, {
					status,
					headers: { Location: new URL(location, event.url).toString() }
				})
			);

		const resolveWithAuthCookies = async () =>
			applyAuthCookies(await resolve(event, withTheme(event)));

		// Logged-in users hitting auth pages get bounced home.
		if (payload && config.isAuthPage?.(pathname)) {
			const home = config.loggedInHome?.(payload) ?? '/';
			return redirectWithAuthCookies(home);
		}

		// Protected paths require auth.
		if (!payload && config.isProtectedPath(pathname)) {
			const next = encodeURIComponent(pathname + search);
			return redirectWithAuthCookies(`/login?next=${next}`);
		}

		// Verified-email gate (e.g. dashboard requires emailConfirmed).
		if (payload && !payload.emailConfirmed && config.requiresEmailConfirmed?.(pathname)) {
			return redirectWithAuthCookies('/account/verify');
		}

		// Password gate for OAuth-created accounts that still need a local password.
		if (payload && !payload.hasPassword && config.requiresPassword?.(pathname)) {
			return redirectWithAuthCookies(config.passwordPath ?? '/account/password');
		}

		return resolveWithAuthCookies();
	};
}

export const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};

export function createGdprHandle({ force = false }: { force?: boolean } = {}): Handle {
	return async ({ event, resolve }) => {
		const cf = (event.request as Request & { cf?: { isEUCountry?: string; country?: string } }).cf;
		const requiresGdpr = force || !!cf?.isEUCountry || cf?.country === 'GB';
		const gdpr = Number(event.cookies.get('gdpr') ?? 0);
		const locals = event.locals as typeof event.locals & GdprLocals;
		locals.gdpr = gdpr;
		locals.needGdpr = requiresGdpr && !gdpr;
		return resolve(event);
	};
}
