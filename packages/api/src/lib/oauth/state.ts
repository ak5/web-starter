import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppContext } from '../../types';

export const APP_REDIRECT = '/dashboard';
const OAUTH_MAX_AGE_SECONDS = 60 * 10;
const OAUTH_RETURN_MAX_LENGTH = 512;

export type OAuthProvider = 'discord' | 'facebook' | 'tiktok' | 'youtube';
export type ChannelOAuthProvider = Exclude<OAuthProvider, 'discord'>;
type ApiContext = Context<AppContext>;

export function getStateCookieName(provider: OAuthProvider) {
	return `${provider}_oauth_state`;
}

export function getReturnCookieName(provider: ChannelOAuthProvider) {
	return `${provider}_oauth_return_to`;
}

export function getSafeReturnTo(value: string | null | undefined) {
	if (!value) return APP_REDIRECT;
	const trimmedValue = value.trim();
	if (
		!trimmedValue.startsWith('/') ||
		trimmedValue.startsWith('//') ||
		trimmedValue.includes('\\') ||
		trimmedValue.length > OAUTH_RETURN_MAX_LENGTH
	) {
		return APP_REDIRECT;
	}
	return trimmedValue;
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

export function appendReturnError(returnTo: string, errorCode: string) {
	const [pathAndSearch, hash] = returnTo.split('#', 2);
	const separator = pathAndSearch.includes('?') ? '&' : '?';
	const nextPath = `${pathAndSearch}${separator}error=${encodeURIComponent(errorCode)}`;
	return hash ? `${nextPath}#${hash}` : nextPath;
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

export function setReturnTo(c: ApiContext, provider: ChannelOAuthProvider) {
	const returnTo = getSafeReturnTo(c.req.query('returnTo'));
	setCookie(c, getReturnCookieName(provider), returnTo, cookieOptions(c));
	return returnTo;
}

export function consumeReturnTo(c: ApiContext, provider: ChannelOAuthProvider) {
	const returnTo = getSafeReturnTo(getCookie(c, getReturnCookieName(provider)));
	deleteCookie(c, getReturnCookieName(provider), cookieOptions(c));
	return returnTo;
}

export function redirectToWeb(c: ApiContext, path: string) {
	return c.redirect(`${c.env.PUBLIC_APP_URL}${path}`);
}

export function redirectToApp(c: ApiContext) {
	return redirectToWeb(c, APP_REDIRECT);
}
