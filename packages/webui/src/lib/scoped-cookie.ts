import type { Cookies } from '@sveltejs/kit';
import { parseOrigin } from '@ak5/shared';

type SameSite = 'strict' | 'lax' | 'none';

interface ScopedCookieOptions {
	path?: string;
	httpOnly?: boolean;
	sameSite?: SameSite;
	maxAge?: number;
}

export function setScopedCookie(
	cookies: Cookies,
	name: string,
	value: string,
	cookieOrigin: string,
	options: ScopedCookieOptions = {}
): void {
	const { domain, secure } = parseOrigin(cookieOrigin);
	cookies.set(name, value, {
		path: options.path ?? '/',
		httpOnly: options.httpOnly ?? true,
		sameSite: options.sameSite ?? 'lax',
		maxAge: options.maxAge,
		domain,
		secure
	});
}

export function clearScopedCookie(cookies: Cookies, name: string, cookieOrigin: string): void {
	const { domain, secure } = parseOrigin(cookieOrigin);
	cookies.delete(name, { path: '/', domain, secure });
}
