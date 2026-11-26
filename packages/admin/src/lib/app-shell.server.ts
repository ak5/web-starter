import { loadShell, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';

export async function loadAppShell(event: ApiRequestEvent) {
	const shell = await loadShell(event, () => api(event).me.$get());
	return shell;
}
