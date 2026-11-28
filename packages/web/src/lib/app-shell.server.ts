import { loadShell, requestState, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';

export async function loadAppShell(event: ApiRequestEvent) {
	const shell = await loadShell(event, () => api(event).me.$get());
	const options = shell.viewer
		? null
		: await api(event)
				.auth.options.$get()
				.catch(() => null);
	return {
		...shell,
		apiUrl: requestState(event.context).env.PUBLIC_API_URL,
		registrationOpen: options?.ok ? (await options.json()).registrationOpen : false
	};
}
