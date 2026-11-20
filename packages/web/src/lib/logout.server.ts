import {
	logoutAction as logoutWithApi,
	requestState,
	type ApiRequestEvent
} from '@ak5/webui/server';
import { api } from './api.server';

export async function logoutToHome(event: ApiRequestEvent): Promise<never> {
	return logoutWithApi({
		...event,
		cookies: requestState(event.context).cookies,
		logout: () => api(event).auth.logout.$post(),
		redirectTo: '/'
	});
}
