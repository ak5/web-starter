import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { apiErrorMessage, errorMessage, forwardSetCookie } from '@ak5/webui';
import { api } from './api';

export function loadVerification(event: RequestEvent) {
	if (event.locals.auth?.emailConfirmed) throw redirect(303, '/dashboard');
	return {
		deliveryFailed: event.url.searchParams.get('delivery') === 'failed',
		deliverySent: event.url.searchParams.get('delivery') === 'sent'
	};
}

export const verificationActions = {
	verify: async (event: RequestEvent) => {
		const data = await event.request.formData();
		const pin = String(data.get('pin') ?? '');
		const res = await api(event.fetch, event.request).auth['verify-email'].$post({ json: { pin } });
		if (!res.ok)
			return fail(res.status, {
				error: errorMessage(await apiErrorMessage(res, 'Email request failed'))
			});
		forwardSetCookie(res, event.cookies);
		throw redirect(303, '/dashboard');
	},
	resend: async (event: RequestEvent) => {
		const res = await api(event.fetch, event.request).auth['resend-verification'].$post();
		if (!res.ok)
			return fail(res.status, {
				error: errorMessage(await apiErrorMessage(res, 'Email request failed'))
			});
		throw redirect(303, '/account/verify?delivery=sent');
	}
};
