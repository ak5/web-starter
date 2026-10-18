<script lang="ts">
	import { enhance } from '$app/forms';
	import ItemsTable from '@ak5/webui/components/ItemsTable.svelte';

	let { data, form } = $props();
</script>

<section class="mx-auto max-w-3xl p-8">
	<h1 class="mb-2 text-3xl font-bold">Your items</h1>
	<p class="mb-6 text-base-content/70">
		An example CRUD resource, rendered with the shared <code>ItemsTable</code> component — the same one
		the admin app uses to list all items.
	</p>

	<form method="POST" action="?/create" use:enhance class="mb-4 flex gap-2">
		<input
			name="title"
			placeholder="New item title"
			class="input-bordered input flex-1"
			aria-label="New item title"
		/>
		<button class="btn btn-primary" type="submit">Add item</button>
	</form>

	{#if form?.message}
		<p class="mb-4 text-sm text-error">{form.message}</p>
	{/if}

	<ItemsTable items={data.items}>
		{#snippet actions(item)}
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={item.id} />
				<button class="btn btn-ghost text-error btn-xs" type="submit">Delete</button>
			</form>
		{/snippet}
	</ItemsTable>
</section>
