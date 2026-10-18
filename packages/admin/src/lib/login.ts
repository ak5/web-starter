import { loginAction as loginWithApi, type ApiRequestEvent, type LoginEvent } from '@ak5/webui';
import { api } from './api';

type AdminLoginEvent = Omit<LoginEvent, 'login' | 'successRedirect'> & ApiRequestEvent;

export async function loginAction(event: AdminLoginEvent) {
	return loginWithApi({
		...event,
		failureIncludesEmail: true,
		login: (json) => api(event.fetch, event.request).auth.admin.login.$post({ json }),
		successRedirect: '/'
	});
}

export const loginActions = {
	default: loginAction
};
