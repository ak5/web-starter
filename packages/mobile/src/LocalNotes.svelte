<script lang="ts">
	import { onMount } from 'svelte';
	import { subscribeNotesSync } from '@ak5/sync/status';
	import { FlatList } from '@symbiote-native/svelte';
	import { randomUUID } from 'expo-crypto';
	import { createStorePromise } from '@livestore/livestore';
	import { makePersistedAdapter } from '@livestore/adapter-expo';
	import { schema, events, notesQuery, notesStoreId, noteText, type Note } from '@ak5/sync';
	import { notesSync } from '@ak5/sync/client';
	import { apiUrl } from './config';
	let { publicId, cookie }: { publicId: string; cookie: string } = $props();
	let store = $state<Awaited<ReturnType<typeof createStorePromise<typeof schema>>> | null>(null);
	let notes = $state<readonly Note[]>([]);
	let text = $state('');
	let selected = $state<string | null>(null);
	let pending = $state(0);
	let error = $state('');
	onMount(() => {
		const abort = new AbortController();
		let dispose = () => {};
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
					error = 'Persistent local storage is unavailable on this device.';
					abort.abort();
					return;
				}
				store = opened;
				const rows = opened.subscribe(notesQuery, (value) => {
					notes = value;
				});
				const status = subscribeNotesSync(opened, (value) => {
					pending = value;
				});
				dispose = () => {
					rows();
					status();
				};
			})
			.catch(() => {
				if (!abort.signal.aborted) error = 'Could not open local notes. Restart the app and retry.';
			});
		return () => {
			dispose();
			abort.abort();
			store = null;
			notes = [];
		};
	});
	function save() {
		try {
			store!.commit(
				events.noteSet({
					id: selected ?? `n-${randomUUID()}`,
					text: noteText(text),
					updatedAt: Date.now()
				})
			);
			text = '';
			selected = null;
			error = '';
		} catch {
			error =
				'Could not save note. Use 1–2,000 characters and retry. Keep a copy if storage is unavailable.';
		}
	}
	function remove(id: string) {
		try {
			store!.commit(events.noteDeleted({ id }));
			if (selected === id) {
				selected = null;
				text = '';
			}
			error = '';
		} catch {
			error = 'Could not delete note. Retry when local storage is available.';
		}
	}
</script>

{#snippet row({ item }: { item: Note })}
	<view class="row">
		<text class="body">{item.text}</text>
		<pressable
			accessibilityRole="button"
			accessibilityLabel="Edit note"
			onPress={() => {
				selected = item.id;
				text = item.text;
			}}><text class="link">Edit</text></pressable
		>
		<pressable
			accessibilityRole="button"
			accessibilityLabel="Delete note"
			onPress={() => remove(item.id)}><text class="link">Delete</text></pressable
		>
	</view>
{/snippet}
<view class="container">
	<text class="heading">Offline notes</text>
	<text class="body" accessibilityLiveRegion="polite"
		>{pending ? `${pending} changes waiting to sync` : 'No pending changes'}</text
	>
	{#if error}<text class="error" accessibilityRole="alert">{error}</text>{/if}
	{#if !store && !error}<text class="body">Opening local database…</text>{/if}
	<text-input
		class="input"
		accessibilityLabel="Note text"
		placeholder="Note text"
		maxLength={2000}
		value={text}
		editable={Boolean(store)}
		onChangeText={(event) => {
			text = String(event.nativeEvent.text ?? '');
		}}
	/>
	<pressable
		class="button"
		accessibilityRole="button"
		accessibilityLabel={selected ? 'Save note' : 'Add note'}
		disabled={!store}
		onPress={save}><text class="button-text">{selected ? 'Save note' : 'Add note'}</text></pressable
	>
	{#if selected}<pressable
			accessibilityRole="button"
			accessibilityLabel="Cancel edit"
			onPress={() => {
				selected = null;
				text = '';
			}}><text class="link">Cancel edit</text></pressable
		>{/if}
	<FlatList
		data={notes}
		item={row}
		keyExtractor={(item) => item.id}
		style={{ flex: 1 }}
		initialNumToRender={8}
		maxToRenderPerBatch={8}
		windowSize={5}
	/>
	<text class="body"
		>Changes stay on this device until synced. Sign back into the same account to resume after sign
		out.</text
	>
</view>

<style>
	.container {
		flex: 1;
		gap: 12px;
	}
	.heading {
		font-size: 20px;
		font-weight: bold;
		color: #0f172a;
	}
	.body {
		font-size: 16px;
		color: #334155;
	}
	.error {
		font-size: 16px;
		color: #b91c1c;
	}
	.input {
		padding: 12px;
		background-color: #fff;
		color: #0f172a;
		border-width: 1px;
		border-color: #64748b;
		border-radius: 8px;
	}
	.button {
		padding: 12px;
		background-color: #1d4ed8;
		border-radius: 8px;
		align-items: center;
	}
	.button-text {
		font-size: 16px;
		color: #fff;
	}
	.link {
		font-size: 16px;
		color: #1d4ed8;
		padding: 8px;
	}
	.row {
		padding: 12px;
		background-color: #fff;
		margin-bottom: 8px;
	}
</style>
