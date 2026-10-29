<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { errorMessage } from '@ak5/webui';
	import OAuthLogin from '#lib/OAuthLogin.svelte';

	let { form } = $props();
	const oauthError = $derived(page.url.searchParams.get('error'));
</script>

<div class="card bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Create your account</h1>
	{#if form?.error || oauthError}
		<div role="alert" class="mb-4 alert alert-error">{form?.error ?? errorMessage(oauthError)}</div>
	{/if}
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<label for="username">Username</label>
		<input
			id="username"
			name="username"
			type="text"
			placeholder="Username"
			autocomplete="username"
			class="input-bordered input w-full"
			value={form?.username ?? ''}
			required
		/>
		<label for="email">Email</label>
		<input
			id="email"
			name="email"
			type="email"
			placeholder="Email"
			autocomplete="email"
			class="input-bordered input w-full"
			value={form?.email ?? ''}
			required
		/>
		<label for="password">Password</label>
		<input
			id="password"
			name="password"
			type="password"
			placeholder="Password (min 8 characters)"
			autocomplete="new-password"
			class="input-bordered input w-full"
			required
		/>
		<button class="btn btn-primary" type="submit">Create account</button>
	</form>
	<OAuthLogin />
	<p class="mt-4 text-sm text-base-content/70">
		Already have an account? <a href="/login" class="link">Sign in</a>
	</p>
</div>
