const ENCODED_UNSAFE_REDIRECT_PATH_CONTENT = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

function hasControlCharacter(value: string) {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

export function getSafeLocalRedirectPath(path: string | null | undefined, fallback = '/') {
	const candidate = path ?? fallback;
	if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
	if (
		candidate.includes('\\') ||
		/%5c/i.test(candidate) ||
		ENCODED_UNSAFE_REDIRECT_PATH_CONTENT.test(candidate) ||
		hasControlCharacter(candidate)
	) {
		return null;
	}

	try {
		const appUrl = new URL('https://www.ak5web.com');
		const next = new URL(candidate, appUrl);
		return next.origin === appUrl.origin ? candidate : null;
	} catch {
		return null;
	}
}

export function getReauthMagicRedirectPath(
	path: string | null | undefined,
	status: 'ok' | 'failed',
	fallback = '/account/password'
) {
	const safePath = getSafeLocalRedirectPath(path, fallback) ?? fallback;
	const url = new URL(safePath, 'https://www.ak5web.com');
	url.searchParams.set('reauth', status);
	return `${url.pathname}${url.search}${url.hash}`;
}
