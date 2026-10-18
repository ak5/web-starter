<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { portal } from 'svelte-portal';
	import { onClickOutside } from 'runed';

	type Props = {
		children: Snippet;
		open: boolean;
		title?: string;
	};
	let { children, open = $bindable(), title }: Props = $props();

	let container = $state<HTMLElement>()!;

	onClickOutside(
		() => container,
		() => (open = false)
	);
</script>

{#if open}
	<div
		use:portal={'body'}
		class="fixed top-0 left-0 z-50 flex min-h-screen w-screen items-center justify-center bg-base-300/80 p-2 backdrop-blur-sm sm:p-4"
	>
		<div
			class="relative mx-auto max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
		>
			<div class="relative text-left" bind:this={container}>
				<!-- Header with close button -->
				<div
					class="flex items-center justify-between border-b border-base-300 bg-base-200/50 px-4 py-3 sm:px-6 sm:py-4"
				>
					{#if title}
						<h3 class="text-lg font-semibold text-base-content">{title}</h3>
					{:else}
						<div></div>
					{/if}
					<button
						onclick={() => (open = false)}
						class="btn btn-circle btn-ghost btn-sm hover:bg-base-300"
					>
						<XIcon class="h-5 w-5" />
					</button>
				</div>

				<!-- Content -->
				<div class="max-h-[calc(90vh-120px)] overflow-y-auto p-4 sm:p-6">
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}

<svelte:window
	on:keydown={(e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			open = false;
		}
	}}
/>
