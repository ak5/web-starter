import { Events, makeSchema, queryDb, Schema, State } from '@livestore/livestore';

export const notes = State.SQLite.table({
	name: 'notes',
	columns: {
		id: State.SQLite.text({ primaryKey: true }),
		text: State.SQLite.text(),
		updatedAt: State.SQLite.integer()
	}
});
export const events = {
	noteSet: Events.synced({
		name: 'v1.NoteSet',
		schema: Schema.Struct({ id: Schema.String, text: Schema.String, updatedAt: Schema.Number })
	}),
	noteDeleted: Events.synced({
		name: 'v1.NoteDeleted',
		schema: Schema.Struct({ id: Schema.String })
	})
};
const materializers = State.SQLite.materializers(events, {
	'v1.NoteSet': (note) => notes.insert(note).onConflict('id', 'replace'),
	'v1.NoteDeleted': ({ id }) => notes.delete().where({ id })
});
export const schema = makeSchema({
	events,
	state: State.SQLite.makeState({ tables: { notes }, materializers })
});
export const notesQuery = queryDb(notes.orderBy('updatedAt', 'desc').orderBy('id', 'asc'));
export type Note = { readonly id: string; readonly text: string; readonly updatedAt: number };

export function notesStoreId(publicId: string) {
	if (!/^u-[a-z0-9]{10}$/.test(publicId)) throw new Error('Invalid user public ID');
	return `notes-v1-${publicId}`;
}
export function noteText(value: string) {
	const text = value.trim();
	if (!text || text.length > 2000) throw new Error('Enter a note between 1 and 2,000 characters.');
	return text;
}
