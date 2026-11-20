import { data, redirect } from 'react-router';
import { requestState, type ApiRequestEvent } from '@ak5/webui/server';
import { apiErrorBody, errorMessage, formString, forwardSetCookie } from '@ak5/webui/server';
import { api } from './api.server';

export async function registerAction(event: ApiRequestEvent) {
	const form = await event.request.formData();
	const email = formString(form, 'email');
	const password = formString(form, 'password');
	const username = formString(form, 'username');

	const res = await api(event).auth.register.$post({
		json: { email, password, username }
	});

	if (!res.ok) {
		const body = (await apiErrorBody(res)) as { error?: string };
		return data(
			{
				error: errorMessage(body.error, 'Registration failed'),
				email,
				username
			},
			{ status: res.status }
		);
	}

	// Forward the api's Set-Cookie (the freshly-minted JWT) and land on the app.
	forwardSetCookie(res, requestState(event.context).cookies);
	const body = (await res.json()) as { verificationEmailSent: boolean };
	throw redirect(
		body.verificationEmailSent ? '/account/verify' : '/account/verify?delivery=failed',
		303
	);
}
