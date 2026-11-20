import { loadShell, requestState, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';

export async function loadAppShell(event: ApiRequestEvent) {
	const shell = await loadShell(event, () => api(event).me.$get());
	return { ...shell, apiUrl: requestState(event.context).env.PUBLIC_API_URL };
}
