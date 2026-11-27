import { useEffect, useState, type FormEvent } from 'react';
import { subscribeNotesSync } from '@ak5/sync/status';
import { events, notesQuery, noteText, type Note } from '@ak5/sync';
import { requestState } from '@ak5/webui/server';
import type { openNotes } from '../lib/notes/store';
import type { Route } from './+types/notes';

export function loader({ context }: Route.LoaderArgs) {
	return { publicId: requestState(context).session.auth?.sub ?? '' };
}

export default function Notes({ loaderData: { publicId } }: Route.ComponentProps) {
	return <NotesEditor key={publicId} publicId={publicId} />;
}

function NotesEditor({ publicId }: { publicId: string }) {
	const [store, setStore] = useState<Awaited<ReturnType<typeof openNotes>> | null>(null);
	const [notes, setNotes] = useState<readonly Note[]>([]);
	const [{ pending, localPending }, setSync] = useState({ pending: 0, localPending: 0 });
	const [text, setText] = useState('');
	const [selected, setSelected] = useState<string | null>(null);
	const [error, setError] = useState('');
	useEffect(() => {
		const abort = new AbortController();
		let dispose = () => {};
		void import('../lib/notes/store')
			.then(async ({ openNotes }) => {
				if (abort.signal.aborted) return;
				const opened = await openNotes(publicId, abort.signal);
				if (abort.signal.aborted) return;
				if (opened.storageMode !== 'persisted') {
					setError('Persistent local storage is unavailable on this device.');
					abort.abort();
					return;
				}
				const rows = opened.subscribe(notesQuery, setNotes);
				const status = subscribeNotesSync(opened, (pending, localPending) =>
					setSync({ pending, localPending })
				);
				dispose = () => {
					rows();
					status();
				};
				setStore(opened);
			})
			.catch(() => {
				if (!abort.signal.aborted) {
					setError(
						'Could not open local storage. Use a supported browser on HTTPS or localhost and retry.'
					);
				}
			});
		return () => {
			dispose();
			abort.abort();
		};
	}, [publicId]);

	function clearSelection() {
		setSelected(null);
		setText('');
	}

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!store) return;
		try {
			store.commit(
				events.noteSet({
					id: selected ?? `n-${crypto.randomUUID()}`,
					text: noteText(text),
					updatedAt: Date.now()
				})
			);
			clearSelection();
			setError('');
		} catch {
			setError(
				'Could not save note. Use 1–2,000 characters and retry. Keep a copy if storage is unavailable.'
			);
		}
	}

	function remove(id: string) {
		if (!store) return;
		try {
			store.commit(events.noteDeleted({ id }));
			if (selected === id) clearSelection();
			setError('');
		} catch {
			setError('Could not delete note. Retry when local storage is available.');
		}
	}

	return (
		<section className="mx-auto max-w-3xl p-8">
			<h1 className="mb-2 text-3xl font-bold">Offline notes</h1>
			<p className="mb-4">Saved on this device. Changes sync to your account when connected.</p>
			<p className="mb-4 text-sm" role="status">
				{localPending
					? 'Saving changes on this device…'
					: pending
						? `${pending} changes waiting to sync`
						: 'No pending changes'}
			</p>
			{error && (
				<p role="alert" className="mb-4 text-danger">
					{error}
				</p>
			)}
			{!store && !error && <p role="status">Opening local database…</p>}
			<form onSubmit={save} className="mb-6 flex gap-2">
				<input
					className="ui-field flex-1"
					aria-label="Note text"
					value={text}
					onChange={(event) => setText(event.currentTarget.value)}
					maxLength={2000}
					required
					disabled={!store}
				/>
				<button className="ui-button ui-button-primary" disabled={!store}>
					{selected ? 'Save note' : 'Add note'}
				</button>
				{selected && (
					<button type="button" className="ui-button" onClick={clearSelection}>
						Cancel
					</button>
				)}
			</form>
			<ul className="space-y-3">
				{notes.map((note) => (
					<li key={note.id} className="ui-panel bg-surface p-4" data-note-id={note.id}>
						<p className="mb-2 break-words whitespace-pre-wrap">{note.text}</p>
						<div className="flex gap-2">
							<button
								className="ui-button ui-button-small"
								onClick={() => {
									setSelected(note.id);
									setText(note.text);
								}}
							>
								Edit
							</button>
							<button
								className="ui-button ui-button-quiet ui-button-small"
								onClick={() => remove(note.id)}
							>
								Delete
							</button>
						</div>
					</li>
				))}
			</ul>
			{store && notes.length === 0 && <p>No notes yet.</p>}
			<p className="mt-6 text-sm">
				Unsynced notes stay on this device after sign out. Sign back into the same account to
				resume.
			</p>
		</section>
	);
}
