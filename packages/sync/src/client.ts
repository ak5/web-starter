import { makeHttpSync } from '@livestore/sync-cf/client';
import { Effect, Schedule, SubscriptionRef } from 'effect';

/** Cookies stay in headers; no auth token or user content is placed in URL parameters. */
export function notesSync(url: string, headers?: Record<string, string>) {
	const http = makeHttpSync({
		url,
		headers,
		livePull: { pollInterval: 3000 },
		ping: { enabled: false }
	});
	const backend: ReturnType<typeof makeHttpSync> = (options) =>
		http(options).pipe(
			Effect.map((sync) => ({
				...sync,
				// Reopening offline must retry initial contact before queued events can flow.
				connect: sync.connect.pipe(
					Effect.andThen(SubscriptionRef.get(sync.isConnected)),
					Effect.retry({ schedule: Schedule.spaced(3000) }),
					Effect.repeat({ schedule: Schedule.spaced(3000), while: (connected) => !connected }),
					Effect.asVoid
				)
			}))
		);
	return { backend };
}
