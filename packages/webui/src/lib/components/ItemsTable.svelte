<!--
  Shared table for the example `items` resource. Presentational only — the page
  supplies the rows (and, optionally, a per-row `actions` snippet). Used by both
  @ak5/web (the signed-in user's own items, with a delete action) and @ak5/admin
  (all items, read-only, with an owner column), demonstrating one shared UI
  component rendering the same shape across both apps.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type ItemRow = {
		id: string;
		data: Record<string, unknown>;
		createdAt: string;
		owner?: string | null;
	};

	let {
		items,
		showOwner = false,
		actions
	}: {
		items: ItemRow[];
		showOwner?: boolean;
		actions?: Snippet<[ItemRow]>;
	} = $props();

	const colspan = $derived(2 + (showOwner ? 1 : 0) + (actions ? 1 : 0));

	function title(data: Record<string, unknown>): string {
		const t = data?.title ?? data?.name ?? data?.label;
		return typeof t === 'string' && t.trim() ? t : '—';
	}

	function details(data: Record<string, unknown>): string {
		const rest = Object.entries(data ?? {}).filter(
			([k]) => !['title', 'name', 'label'].includes(k)
		);
		return rest.length ? JSON.stringify(Object.fromEntries(rest)) : '';
	}

	function when(iso: string): string {
		return new Date(iso).toLocaleString();
	}
</script>

<div class="overflow-x-auto">
	<table class="table">
		<thead>
			<tr>
				<th>Title</th>
				{#if showOwner}<th>Owner</th>{/if}
				<th>Created</th>
				{#if actions}<th class="text-right">Actions</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr>
					<td>
						<div class="font-medium">{title(item.data)}</div>
						{#if details(item.data)}
							<div class="max-w-xs truncate font-mono text-xs text-base-content/50">
								{details(item.data)}
							</div>
						{/if}
					</td>
					{#if showOwner}<td>{item.owner ?? '—'}</td>{/if}
					<td class="text-sm whitespace-nowrap text-base-content/70">{when(item.createdAt)}</td>
					{#if actions}<td class="text-right">{@render actions(item)}</td>{/if}
				</tr>
			{:else}
				<tr>
					<td {colspan} class="text-center text-base-content/60">No items yet.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
