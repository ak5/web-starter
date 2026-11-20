import { loginAction as loginWithApi, requestState, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';

export async function loginAction(event: ApiRequestEvent) {
	return loginWithApi({
		...event,
		cookies: requestState(event.context).cookies,
		failureIncludesEmail: true,
		login: (json) => api(event).auth.admin.login.$post({ json }),
		successRedirect: '/'
	});
}
