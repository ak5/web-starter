type ResponseLike = { headers: Headers };

export function forwardSetCookie(response: ResponseLike, cookies: Headers): void {
	for (const cookie of response.headers.getSetCookie()) cookies.append('Set-Cookie', cookie);
}
