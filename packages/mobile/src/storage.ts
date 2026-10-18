import { getItemAsync, setItemAsync, deleteItemAsync } from '@symbiote-native/secure-store';
import type { SessionStorage } from './client';

const key = 'ak5.session';
export const sessionStorage: SessionStorage = {
	get: () => getItemAsync(key),
	set: (token) => setItemAsync(key, token),
	clear: () => deleteItemAsync(key)
};
