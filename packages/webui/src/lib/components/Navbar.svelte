<script lang="ts">
	import type { Snippet } from 'svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	/**
	 * App top bar: brand on the left, caller-supplied `actions` on the right,
	 * always followed by the theme toggle. Shared by web + admin — pass a
	 * different `brand` and `actions` snippet per app.
	 */
	let {
		brand = 'ak5-web',
		href = '/',
		actions
	}: { brand?: string; href?: string; actions?: Snippet } = $props();
</script>

<header class="navbar border-b border-base-200 bg-base-100">
	<div class="container mx-auto flex flex-wrap items-center gap-2 px-4">
		<a {href} class="flex-1 text-xl font-bold tracking-tight transition-colors hover:text-primary">
			{brand}
		</a>
		<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
			{#if actions}{@render actions()}{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
