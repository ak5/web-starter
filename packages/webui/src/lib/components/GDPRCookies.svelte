<script lang="ts">
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import { page } from '$app/state';
	import GoogleTag from './GoogleTag.svelte';

	// by default everything is checked
	let performance = $state(true);
	let functionality = $state(true);
	let targeting = $state(true);

	let gdpr = $state(page.data.gdpr);

	let showGdpr = $state(page.data.gdpr === 0);
	let showAdvanced = $state(false);
	let showGoogleTag = $derived(gdpr >= 4);

	function setCookie(name: string, value: string, days = 365) {
		const expires = new Date(Date.now() + days * 864e5).toUTCString();
		document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
	}

	function deleteCookie(name: string) {
		document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
	}

	function onAccept() {
		let newGdpr = 0;
		if (performance) newGdpr |= 1;
		if (functionality) newGdpr |= 2;
		if (targeting) newGdpr |= 4;
		gdpr = newGdpr;
		setCookie('gdpr', String(newGdpr));
		if ((newGdpr & 2) !== 2) deleteCookie('theme');
		showGdpr = false;
	}
</script>

{#if showGdpr}
	<!-- Modal Backdrop -->
	<div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"></div>
	<!-- Modal Dialog -->
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div
			class="card w-full max-w-md border border-base-200 bg-base-100 text-base-content shadow-xl"
		>
			<div class="card-body">
				<div class="mb-2 flex items-center gap-2">
					<LockKeyhole class="h-6 w-6 text-primary" />
					<h3 class="card-title text-lg font-bold">Manage Cookie Consent</h3>
				</div>
				<div class="mb-4 space-y-2">
					<p>We use cookies to optimize our website and services.</p>
					<p>Your consent is required for the full use of our website.</p>
					<p>
						For more information, please see our
						<a class="font-semibold text-primary underline" href="/privacy">Privacy Policy</a>.
					</p>
				</div>
				{#if showAdvanced}
					<div class="mb-4 space-y-3 border-t border-base-200 pt-4">
						<div class="flex items-center justify-between">
							<span>Necessary Cookies</span>
							<input type="checkbox" checked disabled class="checkbox checkbox-primary" />
						</div>
						<div class="flex items-center justify-between">
							<span>Performance Cookies</span>
							<input type="checkbox" class="checkbox checkbox-primary" bind:checked={performance} />
						</div>
						<div class="flex items-center justify-between">
							<span>Functionality Cookies</span>
							<input
								type="checkbox"
								class="checkbox checkbox-primary"
								bind:checked={functionality}
							/>
						</div>
						<div class="flex items-center justify-between">
							<span>Targeting Cookies</span>
							<input type="checkbox" class="checkbox checkbox-primary" bind:checked={targeting} />
						</div>
					</div>
				{/if}
				<div class="mt-2 card-actions flex flex-col gap-2 md:flex-row">
					<button type="button" class="btn w-full btn-primary md:w-auto" onclick={onAccept}>
						Accept All
					</button>
					<button
						type="button"
						class="btn w-full btn-outline md:w-auto"
						onclick={() => (showAdvanced = !showAdvanced)}
					>
						{#if !showAdvanced}
							Advanced Settings
						{:else}
							Back
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Floating Button to reopen modal -->
{#if !showGdpr}
	<div class="fixed bottom-8 left-4 z-30 md:bottom-0 md:left-0 md:m-4">
		<button
			class="btn flex btn-circle h-12 w-12 items-center justify-center btn-outline shadow-lg"
			onclick={() => (showGdpr = true)}
			title="Manage Cookie Consent"
		>
			<LockKeyhole />
		</button>
	</div>
{/if}

{#if showGoogleTag}
	<GoogleTag />
{/if}
