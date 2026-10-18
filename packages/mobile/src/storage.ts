import { getItemAsync, setItemAsync, deleteItemAsync } from '@symbiote-native/secure-store';
import type { SessionStorage, SessionUser } from './client';

const key = 'ak5.session';
const viewerKey = 'ak5.viewer';
export const sessionStorage: SessionStorage = {
	get: () => getItemAsync(key),
	set: (token) => setItemAsync(key, token),
	async getViewer() {
		const value = await getItemAsync(viewerKey);
		if (!value) return null;
		try {
			return JSON.parse(value) as SessionUser;
		} catch {
			return null;
		}
	},
	setViewer: (user) => setItemAsync(viewerKey, JSON.stringify(user)),
	async clear() {
		await deleteItemAsync(viewerKey);
		await deleteItemAsync(key);
	}
};
