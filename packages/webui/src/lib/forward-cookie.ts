import type { Cookies } from '@sveltejs/kit';

/**
 * Forward api Set-Cookie headers into a SvelteKit response. The api emits the
 * canonical cookie attributes; web/admin replay them through `cookies.set` so
 * browser auth state stays in sync after actions and server endpoints.
 */
type ResponseLike = { headers: { get: (name: string) => string | null } };

export function forwardSetCookie(res: ResponseLike, cookies: Cookies): void {
	const headers = res.headers as ResponseLike['headers'] & { getSetCookie?: () => string[] };
	const setCookies =
		headers.getSetCookie?.() ??
		res.headers
			.get('set-cookie')
			?.split(/\n|,(?=\s*[^;,]+=)/)
			.map((cookie) => cookie.trim())
			.filter(Boolean) ??
		[];
	for (const setCookie of setCookies) forwardOneSetCookie(setCookie, cookies);
}

function forwardOneSetCookie(setCookie: string, cookies: Cookies): void {
	const parts = setCookie.split(';').map((p) => p.trim());
	const [first, ...rest] = parts;
	const m = first.match(/^([^=]+)=(.*)$/);
	if (!m) return;
	const name = m[1];
	const value = m[2];

	const opts: Parameters<Cookies['set']>[2] = { path: '/' };
	for (const attr of rest) {
		const [k, v] = attr.split('=').map((s) => s.trim());
		const lower = k.toLowerCase();
		if (lower === 'path') opts.path = v ?? '/';
		else if (lower === 'domain') opts.domain = v;
		else if (lower === 'max-age') opts.maxAge = Number(v);
		else if (lower === 'expires' && v) opts.expires = new Date(v);
		else if (lower === 'httponly') opts.httpOnly = true;
		else if (lower === 'secure') opts.secure = true;
		else if (lower === 'samesite' && v) {
			const lc = v.toLowerCase();
			if (lc === 'lax' || lc === 'strict' || lc === 'none') opts.sameSite = lc;
		}
	}
	cookies.set(name, value, opts);
}
