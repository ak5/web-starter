import { type ApiRequestEvent, requestState } from '@ak5/webui/server';
import {
	accountPasswordAction,
	forgotPasswordAction,
	loadAccountPassword,
	magicLoginCallback,
	apiJsonAction
} from '@ak5/webui/server';
import { api } from './api.server';

export function loadPassword(event: ApiRequestEvent) {
	return {
		...loadAccountPassword({ url: event.url, session: requestState(event.context).session }),
		reauth: event.url.searchParams.get('reauth')
	};
}

export const passwordActions = {
	save: (event: ApiRequestEvent) => {
		const client = api(event);
		return accountPasswordAction({
			...event,
			...requestState(event.context),
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
	reauth: async (event: ApiRequestEvent) =>
		apiJsonAction<{ successMessage: string }>(
			await api(event).auth['request-reauth'].$post(),
			'Could not send the confirmation email.'
		)
};

export const recoveryActions = {
	default: (event: ApiRequestEvent) => {
		const client = api(event);
		return forgotPasswordAction({
			...event,
			forgotPassword: (json) => client.auth.admin['forgot-password'].$post({ json })
		});
	}
};

export const magicActions = {
	default: (event: ApiRequestEvent) =>
		magicLoginCallback({
			...event,
			cookies: requestState(event.context).cookies,
			magicLogin: (json) => api(event).auth['magic-login'].$post({ json })
		})
};
