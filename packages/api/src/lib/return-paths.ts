const ENCODED_UNSAFE_REDIRECT_PATH_CONTENT = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

function hasControlCharacter(value: string) {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

export function isSafeLocalRedirectPath(path: string) {
	if (!path.startsWith('/') || path.startsWith('//')) return false;
	if (
		path.includes('\\') ||
		/%5c/i.test(path) ||
		ENCODED_UNSAFE_REDIRECT_PATH_CONTENT.test(path) ||
		hasControlCharacter(path)
	) {
		return false;
	}

	try {
		const appUrl = new URL('https://www.ak5web.com');
		const candidate = new URL(path, appUrl);
		return candidate.origin === appUrl.origin;
	} catch {
		return false;
	}
}

export function getSafeLocalRedirectPath(path: string | null | undefined, fallback = '/') {
	const candidate = path ?? fallback;
	return isSafeLocalRedirectPath(candidate) ? candidate : null;
}

export function appRedirectUrl(origin: string, path: string) {
	return `${origin.replace(/\/$/, '')}${path}`;
}
