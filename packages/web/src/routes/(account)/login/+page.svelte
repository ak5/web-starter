<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import OAuthLogin from '#lib/OAuthLogin.svelte';

	let { form } = $props();

	// OAuth failures redirect back here as `/login?error=…` (see the API's oauth
	// callback). Surface that alongside form-action errors.
	const oauthError = $derived(page.url.searchParams.get('error'));
</script>

<div class="card bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Welcome back</h1>
	{#if form?.error || oauthError}
		<div role="alert" class="mb-4 alert alert-error">{form?.error ?? oauthError}</div>
	{/if}
	<form method="POST" use:enhance class="flex flex-col gap-3">
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
			placeholder="Password"
			autocomplete="current-password"
			class="input-bordered input w-full"
			required
		/>
		<button class="btn btn-primary" type="submit">Sign in</button>
	</form>
	<a href="/forgot-password" class="mt-4 link">Forgot password?</a>
	<OAuthLogin />
	<p class="mt-4 text-sm text-base-content/70">
		No account? <a href="/register" class="link">Create one</a>
	</p>
</div>
