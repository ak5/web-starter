import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppContext } from '../types';

type AuthResponseResult<TBody> =
	| {
			ok: true;
			body: TBody;
			setCookie?: string;
	  }
	| {
			ok: false;
			status: ContentfulStatusCode;
			body: { error: string };
	  };

type AuthMultiCookieResponseResult<TBody> =
	| {
			ok: true;
			body: TBody;
			setCookies?: string[];
	  }
	| {
			ok: false;
			status: ContentfulStatusCode;
			body: { error: string };
	  };

export function authJson<TBody>(c: Context<AppContext>, result: AuthResponseResult<TBody>) {
	if (!result.ok) return c.json(result.body, result.status);
	if (result.setCookie) c.header('set-cookie', result.setCookie);
	return c.json(result.body);
}

export function authJsonWithCookies<TBody>(
	c: Context<AppContext>,
	result: AuthMultiCookieResponseResult<TBody>
) {
	if (!result.ok) return c.json(result.body, result.status);
	const res = c.json(result.body);
	for (const setCookie of result.setCookies ?? []) {
		res.headers.append('set-cookie', setCookie);
	}
	return res;
}
