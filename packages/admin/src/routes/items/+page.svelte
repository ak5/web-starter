<script lang="ts">
	import ItemsTable from '@ak5/webui/components/ItemsTable.svelte';

	let { data } = $props();
</script>

<section class="mx-auto max-w-4xl p-8">
	<h1 class="mb-2 text-3xl font-bold">All items</h1>
	<p class="mb-6 text-base-content/70">
		Every user's items (read-only oversight), rendered with the shared <code>ItemsTable</code> — the same
		component the web app uses for a single user's items.
	</p>
	<ItemsTable items={data.items} showOwner />
</section>
