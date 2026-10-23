import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { apiErrorBody, errorMessage, formString, forwardSetCookie } from '@ak5/webui';
import { api } from './api';

export async function registerAction(event: RequestEvent) {
	const data = await event.request.formData();
	const email = formString(data, 'email');
	const password = formString(data, 'password');
	const username = formString(data, 'username');

	const res = await api(event.fetch, event.request).auth.register.$post({
		json: { email, password, username, legalAcceptance: true }
	});

	if (!res.ok) {
		const body = (await apiErrorBody(res)) as { error?: string };
		return fail(res.status, {
			error: errorMessage(body.error, 'Registration failed'),
			email,
			username
		});
	}

	// Forward the api's Set-Cookie (the freshly-minted JWT) and land on the app.
	forwardSetCookie(res, event.cookies);
	const body = (await res.json()) as { verificationEmailSent: boolean };
	throw redirect(
		303,
		body.verificationEmailSent ? '/account/verify' : '/account/verify?delivery=failed'
	);
}

export const registrationActions = {
	default: registerAction
};
