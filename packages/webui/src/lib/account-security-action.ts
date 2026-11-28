import { data, redirect } from 'react-router';
import { apiErrorBody, apiErrorMessage } from './api-error.js';
import { forwardSetCookie } from './forward-cookie.js';

export async function accountSecurityAction(
	response: Pick<Response, 'ok' | 'status' | 'headers' | 'json'>,
	cookies: Headers,
	success: { message: string } | { redirectTo: string }
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
	if ('redirectTo' in success) return redirect(success.redirectTo, 303);
	return data({ successMessage: success.message }, { headers: { 'Cache-Control': 'no-store' } });
}
