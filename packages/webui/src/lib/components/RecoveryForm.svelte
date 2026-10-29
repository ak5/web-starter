<script lang="ts">
	import { enhance } from '$app/forms';
	let { form }: { form?: { error?: string; successMessage?: string } | null } = $props();
</script>

<svelte:head><title>Reset password</title></svelte:head>
<div class="card mx-auto my-8 max-w-md bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Reset password</h1>
	<p class="mb-4">Enter your account email and we’ll send you a reset link.</p>
	{#if form?.error}<p role="alert" class="mb-4 alert alert-error">{form.error}</p>{/if}
	{#if form?.successMessage}<p role="status" class="mb-4 alert alert-success">
			{form.successMessage}
		</p>{/if}
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<label for="recovery-email">Email</label>
		<input
			id="recovery-email"
			name="email"
			type="email"
			autocomplete="email"
			class="input-bordered input w-full"
			required
		/>
		<button type="submit" class="btn btn-primary">Send reset link</button>
	</form>
	<a href="/login" class="mt-4 link">Back to sign in</a>
</div>
