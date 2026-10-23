import { createStorePromise } from '@livestore/livestore';
import { makePersistedAdapter } from '@livestore/adapter-web';
import SharedWorker from '@livestore/adapter-web/shared-worker?sharedworker';
import NotesWorker from './worker?worker';
import { schema, notesStoreId } from '@ak5/sync';

export function openNotes(publicId: string, signal: AbortSignal) {
	return createStorePromise({
		schema,
		storeId: notesStoreId(publicId),
		signal,
		disableDevtools: true,
		adapter: makePersistedAdapter({
			storage: { type: 'opfs' },
			worker: NotesWorker,
			sharedWorker: SharedWorker
		})
	});
}
