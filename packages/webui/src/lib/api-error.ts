import { responseJsonBody } from './proxy-json.js';

type ApiErrorResponseLike = {
	json(): Promise<unknown>;
};

type ApiErrorBody = {
	error?: unknown;
	message?: unknown;
	url?: unknown;
};

export async function apiErrorBody(res: ApiErrorResponseLike): Promise<ApiErrorBody> {
	const body = await responseJsonBody(res, {});
	return typeof body === 'object' && body !== null ? (body as ApiErrorBody) : {};
}

export async function apiErrorMessage(
	res: ApiErrorResponseLike,
	fallback: string,
	body?: ApiErrorBody
) {
	body ??= await apiErrorBody(res);
	if (typeof body.message === 'string' && body.message) return body.message;
	if (typeof body.error === 'string' && body.error) return body.error;
	return fallback;
}
