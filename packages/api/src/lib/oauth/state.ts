import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppContext } from '../../types';

export const APP_REDIRECT = '/dashboard';
const OAUTH_MAX_AGE_SECONDS = 60 * 10;

export type OAuthProvider = 'discord';
type ApiContext = Context<AppContext>;

export function getStateCookieName(provider: OAuthProvider) {
	return `${provider}_oauth_state`;
}

export function cookieOptions(c: ApiContext) {
	const isLocal =
		c.env.COOKIE_ORIGIN.includes('localhost') ||
		/^\d+\.\d+\.\d+\.\d+$/.test(c.env.COOKIE_ORIGIN.replace(/^\./, ''));
	return {
		path: '/',
		httpOnly: true,
		secure: !isLocal,
		sameSite: 'Lax' as const,
		maxAge: OAUTH_MAX_AGE_SECONDS,
		domain:
			c.env.COOKIE_ORIGIN && c.env.COOKIE_ORIGIN !== 'localhost' ? c.env.COOKIE_ORIGIN : undefined
	};
}

export function issueOAuthState(c: ApiContext, provider: OAuthProvider) {
	const state = crypto.randomUUID();
	setCookie(c, getStateCookieName(provider), state, cookieOptions(c));
	return state;
}

export function validateOAuthState(c: ApiContext, provider: OAuthProvider) {
	const incomingState = c.req.query('state');
	const storedState = getCookie(c, getStateCookieName(provider));
	deleteCookie(c, getStateCookieName(provider), cookieOptions(c));
	return Boolean(incomingState && storedState && incomingState === storedState);
}

export function redirectToWeb(c: ApiContext, path: string) {
	return c.redirect(`${c.env.PUBLIC_APP_URL}${path}`);
}

export function redirectToApp(c: ApiContext) {
	return redirectToWeb(c, APP_REDIRECT);
}
