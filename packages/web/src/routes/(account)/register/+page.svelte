<script lang="ts">
	import { enhance } from '$app/forms';
	import OAuthLogin from '#lib/OAuthLogin.svelte';

	let { form } = $props();
</script>

<div class="card bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Create your account</h1>
	{#if form?.error}
		<div class="mb-4 alert alert-error">{form.error}</div>
	{/if}
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<input
			name="username"
			type="text"
			placeholder="Username"
			autocomplete="username"
			class="input-bordered input w-full"
			value={form?.username ?? ''}
			required
		/>
		<input
			name="email"
			type="email"
			placeholder="Email"
			autocomplete="email"
			class="input-bordered input w-full"
			value={form?.email ?? ''}
			required
		/>
		<input
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
