import { Platform } from 'react-native';
// Babel embeds only public values and reads the root dev slot's direct API port.
const port = process.env.MOBILE_API_PORT || '8350';
export const apiUrl =
	process.env.MOBILE_API_URL ||
	`http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${port}`;

export const webUrl =
	process.env.MOBILE_WEB_URL ||
	`http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${Number(port) + 1}`;
