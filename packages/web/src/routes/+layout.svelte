<script lang="ts">
	import '../app.css';
	import EnvironmentBanner from '@ak5/webui/components/EnvironmentBanner.svelte';
	import Navbar from '@ak5/webui/components/Navbar.svelte';
	import Footer from '@ak5/webui/components/Footer.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<EnvironmentBanner environment={data.environmentBanner} />
	<Navbar brand="ak5-web">
		{#snippet actions()}
			{#if data.auth}
				<a href="/dashboard" class="btn btn-ghost btn-sm">Dashboard</a>
				<a href="/notes" class="btn btn-ghost btn-sm">Offline notes</a>
				<a href="/items" class="btn btn-ghost btn-sm">Items</a>
				<form method="POST" action="/logout">
					<button type="submit" class="btn btn-ghost btn-sm">Sign out</button>
				</form>
			{:else}
				<a href="/login" class="btn btn-ghost btn-sm">Sign in</a>
				<a href="/register" class="btn btn-primary btn-sm">Get started</a>
			{/if}
		{/snippet}
	</Navbar>
	<main class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>
