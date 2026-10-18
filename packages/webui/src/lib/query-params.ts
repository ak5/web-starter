type UrlSource = URL | { url: URL };

function urlFrom(source: UrlSource): URL {
	return source instanceof URL ? source : source.url;
}

export function queryString(source: UrlSource, name: string, fallback = ''): string {
	return urlFrom(source).searchParams.get(name) ?? fallback;
}

export function queryStrings(
	source: UrlSource,
	names: readonly string[],
	fallback = ''
): Record<string, string> {
	const url = urlFrom(source);
	return Object.fromEntries(names.map((name) => [name, url.searchParams.get(name) ?? fallback]));
}
