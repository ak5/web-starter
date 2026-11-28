import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { createStorePromise } from '@livestore/livestore';
import { makePersistedAdapter } from '@livestore/adapter-expo';
import { schema, events, notesQuery, notesStoreId, noteText, type Note } from '@ak5/sync';
import { notesSync } from '@ak5/sync/client';
import { subscribeNotesSync } from '@ak5/sync/status';
import { apiUrl } from './config';
import { ActionButton, placeholderColor, styles } from './ui';

type NotesStore = Awaited<ReturnType<typeof createStorePromise<typeof schema>>>;

export function LocalNotes({ publicId, cookie }: { publicId: string; cookie: string }) {
	const [store, setStore] = useState<NotesStore | null>(null);
	const [notes, setNotes] = useState<readonly Note[]>([]);
	const [text, setText] = useState('');
	const [selected, setSelected] = useState<string | null>(null);
	const [{ pending, localPending }, setSync] = useState({ pending: 0, localPending: 0 });
	const [error, setError] = useState('');

	useEffect(() => {
		const abort = new AbortController();
		let dispose: (() => void) | undefined;
		void createStorePromise({
			schema,
			storeId: notesStoreId(publicId),
			signal: abort.signal,
			disableDevtools: true,
			adapter: makePersistedAdapter({
				storage: { subDirectory: 'ak5-notes' },
				sync: notesSync(new URL('/sync', apiUrl).href, { Cookie: cookie })
			})
		})
			.then((opened) => {
				if (abort.signal.aborted) return;
				if (opened.storageMode !== 'persisted') {
					setError('Persistent local storage is unavailable on this device.');
					abort.abort();
					return;
				}
				const unsubscribeNotes = opened.subscribe(notesQuery, setNotes);
				const unsubscribeStatus = subscribeNotesSync(opened, (pending, localPending) =>
					setSync({ pending, localPending })
				);
				dispose = () => {
					unsubscribeNotes();
					unsubscribeStatus();
				};
				setStore(opened);
				setError('');
			})
			.catch(() => {
				if (!abort.signal.aborted)
					setError('Could not open local notes. Restart the app and retry.');
			});
		return () => {
			dispose?.();
			abort.abort();
		};
	}, [publicId, cookie]);

	function clearEditor() {
		setText('');
		setSelected(null);
	}

	function save() {
		if (!store) return;
		try {
			store.commit(
				events.noteSet({
					id: selected ?? `n-${randomUUID()}`,
					text: noteText(text),
					updatedAt: Date.now()
				})
			);
			clearEditor();
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
			if (selected === id) clearEditor();
			setError('');
		} catch {
			setError('Could not delete note. Retry when local storage is available.');
		}
	}

	return (
		<View style={[styles.fill, styles.notes]}>
			<Text style={styles.heading}>Offline notes</Text>
			<Text style={styles.body} accessibilityLiveRegion="polite">
				{localPending
					? 'Saving changes on this device…'
					: pending
						? `${pending} changes waiting to sync`
						: 'No pending changes'}
			</Text>
			{error !== '' && (
				<Text style={styles.error} accessibilityRole="alert">
					{error}
				</Text>
			)}
			{!store && !error && <Text style={styles.body}>Opening local database…</Text>}
			<TextInput
				style={styles.input}
				accessibilityLabel="Note text"
				placeholder="Note text"
				placeholderTextColor={placeholderColor}
				maxLength={2000}
				value={text}
				editable={Boolean(store)}
				onChangeText={setText}
			/>
			<ActionButton label={selected ? 'Save note' : 'Add note'} disabled={!store} onPress={save} />
			{selected && (
				<Pressable accessibilityRole="button" onPress={clearEditor}>
					<Text style={styles.link}>Cancel edit</Text>
				</Pressable>
			)}
			<FlatList
				data={notes}
				style={styles.fill}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.row}>
						<Text style={styles.body}>{item.text}</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Edit note"
							onPress={() => {
								setSelected(item.id);
								setText(item.text);
							}}
						>
							<Text style={styles.link}>Edit</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Delete note"
							onPress={() => remove(item.id)}
						>
							<Text style={styles.link}>Delete</Text>
						</Pressable>
					</View>
				)}
				initialNumToRender={8}
				maxToRenderPerBatch={8}
				windowSize={5}
				keyboardShouldPersistTaps="handled"
			/>
			<Text style={styles.body}>
				Changes stay on this device until synced. Sign back into the same account to resume after
				sign out.
			</Text>
		</View>
	);
}
