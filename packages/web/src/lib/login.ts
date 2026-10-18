import { loginAction as loginWithApi, type ApiRequestEvent, type LoginEvent } from '@ak5/webui';
import { api } from './api';

type WebLoginEvent = Omit<LoginEvent, 'login' | 'successRedirect'> & ApiRequestEvent;

export async function loginAction(event: WebLoginEvent) {
	return loginWithApi({
		...event,
		failureIncludesEmail: true,
		login: (json) => api(event.fetch, event.request).auth.login.$post({ json }),
		successRedirect: '/dashboard'
	});
}

export const loginActions = {
	default: loginAction
};
