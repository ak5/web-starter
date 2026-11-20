import { apiLoadJson, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';
export async function loadUsers(event: ApiRequestEvent) {
	const response = await api(event).admin.users.$get();
	const data = await apiLoadJson(response, 'Could not load users. Please retry.');
	return { users: data.users };
}
