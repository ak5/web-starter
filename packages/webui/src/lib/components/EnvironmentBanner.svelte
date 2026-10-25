<script lang="ts">
	import { afterNavigate } from '$app/navigation';

	let { environment }: { environment?: string } = $props();
	let dismissed = $state(false);
	let ready = $state(false);
	afterNavigate(() => {
		ready = true;
		dismissed = false;
	});
</script>

{#if environment && !dismissed}
	<aside
		aria-label="Environment"
		class="flex items-center justify-between gap-4 bg-warning px-4 py-2 text-sm text-warning-content"
	>
		<span><strong>{environment}</strong> environment</span>
		<button
			type="button"
			disabled={!ready}
			class="btn btn-ghost btn-xs"
			aria-label="Dismiss environment banner"
			onclick={() => {
				dismissed = true;
			}}>Dismiss</button
		>
	</aside>
{/if}
