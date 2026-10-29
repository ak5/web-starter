<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="card bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Admin sign in</h1>
	{#if form?.error}
		<div role="alert" class="mb-4 alert alert-error">{form.error}</div>
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
</div>
