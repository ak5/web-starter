import { data, redirect } from 'react-router';
import { requestState, type ApiRequestEvent } from '@ak5/webui/server';
import { apiErrorMessage, forwardSetCookie } from '@ak5/webui/server';
import { api } from './api.server';

export function loadVerification(event: ApiRequestEvent) {
	if (requestState(event.context).session.auth?.emailConfirmed) throw redirect('/dashboard', 303);
	return {
		deliveryFailed: event.url.searchParams.get('delivery') === 'failed',
		deliverySent: event.url.searchParams.get('delivery') === 'sent'
	};
}

export const verificationActions = {
	verify: async (event: ApiRequestEvent, form: FormData) => {
		const pin = String(form.get('pin') ?? '');
		const res = await api(event).auth['verify-email'].$post({ json: { pin } });
		if (!res.ok)
			return data(
				{
					error: await apiErrorMessage(res, 'Email request failed')
				},
				{ status: res.status }
			);
		forwardSetCookie(res, requestState(event.context).cookies);
		throw redirect('/dashboard', 303);
	},
	resend: async (event: ApiRequestEvent) => {
		const res = await api(event).auth['resend-verification'].$post();
		if (!res.ok)
			return data(
				{
					error: await apiErrorMessage(res, 'Email request failed')
				},
				{ status: res.status }
			);
		throw redirect('/account/verify?delivery=sent', 303);
	}
};
