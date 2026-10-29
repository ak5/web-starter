import type { RequestEvent } from '@sveltejs/kit';
import {
	accountPasswordAction,
	forgotPasswordAction,
	loadAccountPassword,
	magicLoginCallback,
	apiJsonAction
} from '@ak5/webui';
import { api } from './api';

export function loadPassword(event: RequestEvent) {
	return { ...loadAccountPassword(event), reauth: event.url.searchParams.get('reauth') };
}

export const passwordActions = {
	save: (event: RequestEvent) => {
		const client = api(event.fetch, event.request);
		return accountPasswordAction({
			...event,
			acceptInvite: (json) => client.auth['accept-invite'].$post({ json }),
			changePassword: (json) => client.auth['change-password'].$post({ json }),
			setPassword: (json) => client.auth['set-password'].$post({ json }),
			includeFailureCode: true,
			failures: {
				acceptInvite: 'Could not reset your password.',
				changePassword: 'Could not change your password.',
				setPassword: 'Could not set your password.'
			}
		});
	},
	reauth: async (event: RequestEvent) =>
		apiJsonAction<{ successMessage: string }>(
			await api(event.fetch, event.request).auth['request-reauth'].$post(),
			'Could not send the confirmation email.'
		)
};

export const recoveryActions = {
	default: (event: RequestEvent) => {
		const client = api(event.fetch, event.request);
		return forgotPasswordAction({
			...event,
			forgotPassword: (json) => client.auth['forgot-password'].$post({ json })
		});
	}
};

export const magicActions = {
	default: (event: RequestEvent) =>
		magicLoginCallback({
			...event,
			magicLogin: (json) => api(event.fetch, event.request).auth['magic-login'].$post({ json })
		})
};
