export function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
	return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
