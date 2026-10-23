import { StoreInternalsSymbol, type Store } from '@livestore/livestore';
import { Effect, Fiber, Stream } from 'effect';
import type { schema } from './schema';

export function subscribeNotesSync(
	store: Store<typeof schema>,
	onUpdate: (pending: number) => void
) {
	// shortcut: LiveStore 0.5 exposes backend acknowledgements through internals; use a public subscription when available.
	const leader = store[StoreInternalsSymbol].clientSession.leaderThread.syncState;
	const backend = Stream.concat(Stream.fromEffect(leader), leader.changes);
	const fiber = Stream.zipLatest(store.syncStatusStream(), backend).pipe(
		Stream.tap(([session, remote]) =>
			Effect.sync(() => onUpdate(session.pendingCount + remote.pending.length))
		),
		Stream.runDrain,
		Effect.runFork
	);
	return () => {
		Effect.runFork(Fiber.interrupt(fiber));
	};
}
