import { data } from 'react-router';
import { apiErrorBody, apiErrorMessage } from './api-error.js';
import { forwardSetCookie } from './forward-cookie.js';

export async function emailChangeAction(
	response: Pick<Response, 'ok' | 'status' | 'headers' | 'json'>,
	cookies: Headers,
	successMessage: string
) {
	if (!response.ok) {
		const body = await apiErrorBody(response);
		return data(
			{
				error: await apiErrorMessage(response, 'Could not complete the request.', body),
				reauth: body.error === 'recent_auth_required'
			},
			{ status: response.status, headers: { 'Cache-Control': 'no-store' } }
		);
	}
	forwardSetCookie(response, cookies);
	return data({ successMessage }, { headers: { 'Cache-Control': 'no-store' } });
}
