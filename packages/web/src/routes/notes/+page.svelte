<script lang="ts">
	import { onMount } from 'svelte';
	import { events, notesQuery, noteText, type Note } from '@ak5/sync';
	import type { openNotes } from '#lib/notes/store.js';
	let { data } = $props();
	let store = $state<Awaited<ReturnType<typeof openNotes>> | null>(null);
	let notes = $state<readonly Note[]>([]);
	let pending = $state(0);
	let text = $state('');
	let selected = $state<string | null>(null);
	let error = $state('');
	onMount(() => {
		const abort = new AbortController();
		let dispose = () => {};
		void import('#lib/notes/store.js')
			.then(async ({ openNotes }) => {
				if (abort.signal.aborted) return;
				const opened = await openNotes(data.auth!.sub, abort.signal);
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
				const status = opened.subscribeSyncStatus((value) => {
					pending = value.pendingCount;
				});
				dispose = () => {
					rows();
					status();
				};
			})
			.catch(() => {
				if (!abort.signal.aborted)
					error =
						'Could not open local storage. Use a supported browser on HTTPS or localhost and retry.';
			});
		return () => {
			dispose();
			abort.abort();
			store = null;
			notes = [];
		};
	});
	function save(event: SubmitEvent) {
		event.preventDefault();
		try {
			store!.commit(
				events.noteSet({
					id: selected ?? `n-${crypto.randomUUID()}`,
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

<section class="mx-auto max-w-3xl p-8">
	<h1 class="mb-2 text-3xl font-bold">Offline notes</h1>
	<p class="mb-4">Saved on this device. Changes sync to your account when connected.</p>
	<p class="mb-4 text-sm" role="status">
		{pending ? `${pending} changes waiting to sync` : 'No pending changes'}
	</p>
	{#if error}<p role="alert" class="mb-4 text-error">{error}</p>{/if}
	{#if !store && !error}<p role="status">Opening local database…</p>{/if}
	<form onsubmit={save} class="mb-6 flex gap-2">
		<input
			class="input-bordered input flex-1"
			aria-label="Note text"
			bind:value={text}
			maxlength={2000}
			required
			disabled={!store}
		/>
		<button class="btn btn-primary" disabled={!store}>{selected ? 'Save note' : 'Add note'}</button>
		{#if selected}<button
				type="button"
				class="btn"
				onclick={() => {
					selected = null;
					text = '';
				}}>Cancel</button
			>{/if}
	</form>
	<ul class="space-y-3">
		{#each notes as note (note.id)}
			<li class="card bg-base-200 p-4" data-note-id={note.id}>
				<p class="mb-2 break-words whitespace-pre-wrap">{note.text}</p>
				<div class="flex gap-2">
					<button
						class="btn btn-sm"
						onclick={() => {
							selected = note.id;
							text = note.text;
						}}>Edit</button
					>
					<button class="btn btn-ghost btn-sm" onclick={() => remove(note.id)}>Delete</button>
				</div>
			</li>
		{/each}
	</ul>
	{#if store && notes.length === 0}<p>No notes yet.</p>{/if}
	<p class="mt-6 text-sm">
		Unsynced notes stay on this device after sign out. Sign back into the same account to resume.
	</p>
</section>
