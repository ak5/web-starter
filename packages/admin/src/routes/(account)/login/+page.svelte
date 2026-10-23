<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="card bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Admin sign in</h1>
	{#if form?.error}
		<div class="mb-4 alert alert-error">{form.error}</div>
	{/if}
	<form method="POST" use:enhance class="flex flex-col gap-3">
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
			placeholder="Password"
			autocomplete="current-password"
			class="input-bordered input w-full"
			required
		/>
		<button class="btn btn-primary" type="submit">Sign in</button>
	</form>
</div>
