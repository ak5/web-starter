import { makeHttpSync } from '@livestore/sync-cf/client';

/** Cookies stay in headers; no auth token or user content is placed in URL parameters. */
export function notesSync(url: string, headers?: Record<string, string>) {
	return {
		backend: makeHttpSync({
			url,
			headers,
			livePull: { pollInterval: 3000 },
			ping: { enabled: false }
		})
	};
}
