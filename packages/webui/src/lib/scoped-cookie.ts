import { parseOrigin } from '@ak5/shared';

interface ScopedCookieOptions {
	path?: string;
	httpOnly?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
	maxAge?: number;
}

export function setScopedCookie(
	cookies: Headers,
	name: string,
	value: string,
	cookieOrigin: string,
	{ path = '/', httpOnly = true, sameSite = 'lax', maxAge }: ScopedCookieOptions = {}
): void {
	const { domain, secure } = parseOrigin(cookieOrigin);
	cookies.append(
		'Set-Cookie',
		[
			name + '=' + encodeURIComponent(value),
			'Path=' + path,
			'SameSite=' + sameSite,
			domain && 'Domain=' + domain,
			secure && 'Secure',
			httpOnly && 'HttpOnly',
			maxAge != null && 'Max-Age=' + maxAge
		]
			.filter(Boolean)
			.join('; ')
	);
}

export function clearScopedCookie(cookies: Headers, name: string, cookieOrigin: string): void {
	setScopedCookie(cookies, name, '', cookieOrigin, { maxAge: 0 });
}
