import { Platform } from 'react-native';
// Expo embeds the public API origin and the active local stack port.
const port = process.env.EXPO_PUBLIC_MOBILE_API_PORT || '8350';
export const apiUrl =
	process.env.EXPO_PUBLIC_MOBILE_API_URL ||
	`http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${port}`;
