import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { StoreInternalsSymbol } from '@livestore/livestore';
import { Effect, SubscriptionRef } from 'effect';
import { subscribeNotesSync } from './status.ts';

test('notes remain pending after local persistence until the server acknowledges them', async () => {
	const session = Effect.runSync(SubscriptionRef.make({ pendingCount: 0 }));
	const leader = Effect.runSync(SubscriptionRef.make({ pending: [] }));
	const store = {
		syncStatusStream: () => SubscriptionRef.changes(session),
		[StoreInternalsSymbol]: {
			clientSession: {
				leaderThread: {
					syncState: Object.assign(SubscriptionRef.get(leader), {
						changes: SubscriptionRef.changes(leader)
					})
				}
			}
		}
	};
	const values = [];
	const unsubscribe = subscribeNotesSync(store, (pending, local) => values.push([pending, local]));
	const expectPending = async (pending, local = 0) => {
		const matches = () => values.at(-1)?.[0] === pending && values.at(-1)?.[1] === local;
		for (let i = 0; i < 100 && !matches(); i++) await setTimeout(5);
		assert.deepEqual(values.at(-1), [pending, local]);
	};
	try {
		await expectPending(0);
		await Effect.runPromise(SubscriptionRef.set(session, { pendingCount: 1 }));
		await expectPending(1, 1);
		await Effect.runPromise(SubscriptionRef.set(leader, { pending: [{}] }));
		await expectPending(2, 1);
		await Effect.runPromise(SubscriptionRef.set(session, { pendingCount: 0 }));
		await expectPending(1);
		await Effect.runPromise(SubscriptionRef.set(leader, { pending: [] }));
		await expectPending(0);
	} finally {
		unsubscribe();
	}
	await setTimeout(5);
	const count = values.length;
	await Effect.runPromise(SubscriptionRef.set(leader, { pending: [{}] }));
	await setTimeout(5);
	assert.equal(values.length, count);
});
