import { makeWorker } from '@livestore/adapter-web/worker';
import { schema } from '@ak5/sync';
import { notesSync } from '@ak5/sync/client';

makeWorker({ schema, sync: notesSync(new URL('/sync', self.location.origin).href) });
