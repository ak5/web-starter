import { logoutAction as logoutWithApi, type ApiRequestEvent, type LogoutEvent } from '@ak5/webui';
import { api } from './api';

type WebLogoutEvent = Omit<LogoutEvent, 'logout' | 'redirectTo'> & ApiRequestEvent;

export async function logoutToHome(event: WebLogoutEvent): Promise<never> {
	return logoutWithApi({
		...event,
		logout: () => api(event.fetch, event.request).auth.logout.$post(),
		redirectTo: '/'
	});
}
