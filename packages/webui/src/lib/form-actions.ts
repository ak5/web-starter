import { data, redirect } from 'react-router';

import { apiErrorBody, apiErrorMessage } from './api-error.js';
import { forwardSetCookie } from './forward-cookie.js';
import { responseJsonBody } from './proxy-json.js';

type ResponseLike = {
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
};
type JsonOf<Response extends { json(): Promise<unknown> }> = [
	Extract<Response, { ok: true }>
] extends [never]
	? Awaited<ReturnType<Response['json']>>
	: Awaited<ReturnType<Extract<Response, { ok: true }>['json']>>;

type FailureKey = 'error' | 'message';
type FailurePayload<Key extends FailureKey> = Record<Key, string>;

export function formString(data: FormData, name: string, fallback = ''): string {
	return String(data.get(name) ?? fallback);
}

export function formStringAny(data: FormData, ...names: string[]): string {
	for (const name of names) {
		const value = data.get(name);
		if (value != null) return String(value);
	}
	return '';
}

export function formStringAll(data: FormData, name: string): string[] {
	return data.getAll(name).map((value) => String(value));
}

function actionFailure<Key extends FailureKey>(status: number, failureKey: Key, message: string) {
	return data({ [failureKey]: message } as FailurePayload<Key>, { status });
}

export async function apiJsonAction<Result = unknown, Key extends FailureKey = 'error'>(
	res: ResponseLike,
	fallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}
	return responseJsonBody<Result>(res, {} as Result);
}

export async function apiLoadJson<Response extends ResponseLike>(
	res: Response,
	fallback: string
): Promise<JsonOf<Response>> {
	if (!res.ok) throw data(fallback, { status: res.status });
	return res.json().catch(() => {
		throw data(fallback, { status: 502 });
	}) as Promise<JsonOf<Response>>;
}

export async function apiRedirectAction<Key extends FailureKey = 'error'>(
	res: ResponseLike,
	fallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}

	const { redirectTo } = await responseJsonBody<{ redirectTo: string }>(res, { redirectTo: '/' });
	throw redirect(redirectTo, 303);
}

export async function apiStaticRedirectAction<Key extends FailureKey = 'error'>(
	res: ResponseLike,
	redirectTo: string,
	fallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}

	throw redirect(redirectTo, 303);
}

export async function apiCookieRedirectAction<Key extends FailureKey = 'error'>(
	res: ResponseLike & { headers: Headers },
	cookies: Headers,
	fallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}

	const { redirectTo } = await responseJsonBody<{ redirectTo: string }>(res, { redirectTo: '/' });
	forwardSetCookie(res, cookies);
	throw redirect(redirectTo, 303);
}

export async function apiCookieStaticRedirectAction<Key extends FailureKey = 'error'>(
	res: ResponseLike & { headers: Headers },
	cookies: Headers,
	redirectTo: string,
	fallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}

	forwardSetCookie(res, cookies);
	throw redirect(redirectTo, 303);
}

export async function apiUrlRedirectAction<Key extends FailureKey = 'error'>(
	res: ResponseLike,
	fallback: string,
	missingUrlFallback: string,
	failureKey: Key = 'error' as Key
) {
	if (!res.ok) {
		return actionFailure(res.status, failureKey, await apiErrorMessage(res, fallback));
	}

	const { url } = await responseJsonBody<{ url?: string | null }>(res, {});
	if (!url) return actionFailure(500, failureKey, missingUrlFallback);
	throw redirect(url, 303);
}

export async function apiUrlRedirectResponse(
	res: ResponseLike,
	fallback: string,
	missingUrlFallback: string,
	status = 303
): Promise<never> {
	if (!res.ok) {
		throw data(await apiErrorMessage(res, fallback), { status: res.status });
	}

	const { url } = await responseJsonBody<{ url?: string | null }>(res, {});
	if (!url) throw data(missingUrlFallback, { status: 502 });
	throw redirect(url, status);
}

export async function apiUploadUrlAction<Key extends FailureKey = 'error'>(
	res: ResponseLike,
	fallback: string,
	missingUrlFallback = fallback,
	failureKey: Key = 'error' as Key
) {
	const body = await apiErrorBody(res);
	const url = typeof body.url === 'string' ? body.url : null;
	if (!res.ok || !url) {
		const message = await apiErrorMessage(res, !res.ok ? fallback : missingUrlFallback, body);
		return actionFailure(res.ok ? 500 : res.status, failureKey, message);
	}
	return { url };
}
