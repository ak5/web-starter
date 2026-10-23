<script lang="ts">
	import '../app.css';
	import Navbar from '@ak5/webui/components/Navbar.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Navbar brand="ak5-web admin">
		{#snippet actions()}
			{#if data.auth}
				<a href="/" class="btn btn-ghost btn-sm">Users</a>
				<a href="/items" class="btn btn-ghost btn-sm">Items</a>
				<form method="POST" action="/logout">
					<button type="submit" class="btn btn-ghost btn-sm">Sign out</button>
				</form>
			{/if}
		{/snippet}
	</Navbar>
	<main class="flex-1">
		{@render children()}
	</main>
</div>
