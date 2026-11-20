import { redirect, type MiddlewareFunction } from 'react-router';
import {
	COOKIE_ADMIN_TOKEN,
	COOKIE_TOKEN,
	clearJwtCookie,
	jwtCookie,
	parseCookie,
	refreshJwt,
	shouldRefreshJwt,
	verifyJwt,
	type JwtType
} from '@ak5/shared';
import { apiBaseUrl, validateApiSession } from './api-client.js';
import { requestState } from './request-context.js';

interface AuthPolicy {
	allowedJwtType: JwtType;
	isProtectedPath: (pathname: string) => boolean;
	isAuthPage: (pathname: string) => boolean;
	loggedInHome: string;
}

export function createAuthMiddleware(policy: AuthPolicy): MiddlewareFunction<Response> {
	return async ({ request, url, context }, next) => {
		const state = requestState(context);
		const secret = state.env.JWT_SECRET;
		const cookieOrigin = state.env.PUBLIC_COOKIE_ORIGIN;
		if (!secret) throw new Error('JWT_SECRET is not configured');
		if (cookieOrigin == null) throw new Error('PUBLIC_COOKIE_ORIGIN is not configured');

		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		const { search } = url;
		const cookieHeader = request.headers.get('cookie');
		const raw = parseCookie(cookieHeader, COOKIE_TOKEN);
		const stash = parseCookie(cookieHeader, COOKIE_ADMIN_TOKEN);
		let token = raw ?? null;
		let auth = token ? await verifyJwt(secret, token) : null;
		if (auth?.type !== policy.allowedJwtType) {
			auth = stash ? await verifyJwt(secret, stash) : null;
			token = auth?.type === policy.allowedJwtType ? (stash ?? null) : null;
			if (!token) auth = null;
		}

		let rejected = false;
		if (auth && token) {
			if (!(await validateApiSession(apiBaseUrl(state.env), state.fetch, token))) {
				auth = null;
				token = null;
				rejected = true;
			} else if (shouldRefreshJwt(auth)) {
				token = await refreshJwt(auth, secret);
			}
		}
		state.session.auth = auth;

		const finish = (response: Response) => {
			const headers = new Headers(response.headers);
			if (
				raw ||
				auth ||
				policy.isProtectedPath(pathname) ||
				policy.isAuthPage(pathname) ||
				request.method !== 'GET' ||
				pathname.startsWith('/account/') ||
				pathname.startsWith('/auth/') ||
				pathname === '/invite' ||
				pathname === '/forgot-password'
			) {
				headers.set('Cache-Control', 'no-store');
			}
			const actionCookies = state.cookies.getSetCookie();
			const writes = [...headers.getSetCookie(), ...actionCookies];
			const writesCookie = (name: string) => writes.some((cookie) => cookie.startsWith(name + '='));
			if (!writesCookie(COOKIE_TOKEN)) {
				if (raw && !auth) headers.append('Set-Cookie', clearJwtCookie(COOKIE_TOKEN, cookieOrigin));
				if (auth && token && token !== raw) {
					headers.append(
						'Set-Cookie',
						jwtCookie({ name: COOKIE_TOKEN, value: token, cookieOrigin })
					);
				}
			}
			if (
				!writesCookie(COOKIE_ADMIN_TOKEN) &&
				stash &&
				(rejected || (token === stash && token !== raw))
			) {
				headers.append('Set-Cookie', clearJwtCookie(COOKIE_ADMIN_TOKEN, cookieOrigin));
			}
			for (const cookie of actionCookies) headers.append('Set-Cookie', cookie);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		};

		if (auth && policy.isAuthPage(pathname)) throw finish(redirect(policy.loggedInHome, 303));
		if (!auth && policy.isProtectedPath(pathname)) {
			throw finish(redirect('/login?next=' + encodeURIComponent(pathname + search), 303));
		}
		return finish(await next());
	};
}
