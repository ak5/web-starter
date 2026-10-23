import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppContext } from '../types';

type ApiErrorResult = {
	error?: string;
	message?: string;
	status?: ContentfulStatusCode;
};

type ApiBodyResult =
	| {
			ok: true;
			body: object;
			status?: ContentfulStatusCode;
			headers?: Record<string, string>;
	  }
	| {
			ok: false;
			body: object;
			status: ContentfulStatusCode;
			headers?: Record<string, string>;
	  };

type ApiBodySetCookiesResult =
	| {
			ok: true;
			body: object;
			cookies: string[];
			status?: ContentfulStatusCode;
	  }
	| {
			ok: false;
			body: object;
			status: ContentfulStatusCode;
	  };

type ApiBodySetCookieResult =
	| {
			ok: true;
			body: object;
			setCookie: string;
			status?: ContentfulStatusCode;
	  }
	| {
			ok: false;
			body: object;
			status: ContentfulStatusCode;
	  };

type ApiResultResult =
	| {
			ok: true;
			result: object;
	  }
	| (ApiErrorResult & {
			ok: false;
	  });

type ApiNamedResult<TKey extends string> =
	| (Record<TKey, object> & {
			ok: true;
	  })
	| (ApiErrorResult & {
			ok: false;
	  });

export function apiErrorBody(result: Pick<ApiErrorResult, 'error' | 'message'>) {
	const error = result.error ?? 'internal_error';
	return result.message ? { error, message: result.message } : { error };
}

export function apiErrorJson(c: Context<AppContext>, result: ApiErrorResult) {
	return c.json(apiErrorBody(result), result.status ?? 500);
}

export function apiBodyJson(
	c: Context<AppContext>,
	result: ApiBodyResult,
	successStatus?: ContentfulStatusCode
) {
	if (!result.ok) {
		if (result.headers) return c.json(result.body, result.status, result.headers);
		return c.json(result.body, result.status);
	}
	const status = successStatus ?? result.status;
	if (result.headers) return c.json(result.body, status ?? 200, result.headers);
	if (successStatus) return c.json(result.body, successStatus);
	if (result.status) return c.json(result.body, result.status);
	return c.json(result.body);
}

export function apiResultJson<R extends ApiResultResult>(
	c: Context<AppContext>,
	result: R,
	successStatus?: ContentfulStatusCode
) {
	if (!result.ok) return apiErrorJson(c, result);
	const body = result.result as Extract<R, { ok: true }>['result'];
	if (successStatus) return c.json(body, successStatus);
	return c.json(body);
}

export function apiNamedJson<TKey extends string>(
	c: Context<AppContext>,
	result: ApiNamedResult<TKey>,
	key: TKey,
	successStatus?: ContentfulStatusCode
) {
	if (!result.ok) return apiErrorJson(c, result);
	if (successStatus) return c.json(result[key], successStatus);
	return c.json(result[key]);
}

export function apiJsonWithSetCookie<TBody>(
	c: Context<AppContext>,
	body: TBody,
	setCookie: string,
	status?: ContentfulStatusCode
) {
	if (!status) {
		c.header('set-cookie', setCookie);
		return c.json(body);
	}
	return c.json(body, status, { 'set-cookie': setCookie });
}

export function apiJsonWithSetCookies<TBody>(
	c: Context<AppContext>,
	body: TBody,
	setCookies: string[],
	status?: ContentfulStatusCode
) {
	const res = status ? c.json(body, status) : c.json(body);
	for (const setCookie of setCookies) {
		res.headers.append('set-cookie', setCookie);
	}
	return res;
}

export function apiBodyJsonWithSetCookies(c: Context<AppContext>, result: ApiBodySetCookiesResult) {
	if (!result.ok) return apiBodyJson(c, result);
	return apiJsonWithSetCookies(c, result.body, result.cookies, result.status);
}

export function apiBodyJsonWithSetCookie(c: Context<AppContext>, result: ApiBodySetCookieResult) {
	if (!result.ok) return apiBodyJson(c, result);
	return apiJsonWithSetCookie(c, result.body, result.setCookie, result.status);
}
