<script lang="ts">
	import { enhance } from '$app/forms';
	let {
		resetToken = '',
		hasPassword,
		reauth,
		form
	}: {
		resetToken?: string;
		hasPassword: boolean;
		reauth?: string | null;
		form?: { error?: string; code?: string; successMessage?: string } | null;
	} = $props();
	const title = $derived(
		resetToken ? 'Set your new password' : hasPassword ? 'Change password' : 'Set a password'
	);
</script>

<svelte:head><title>{title}</title></svelte:head>
<div class="card mx-auto my-8 max-w-md bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">{title}</h1>
	{#if form?.error}<p role="alert" class="mb-4 alert alert-error">{form.error}</p>{/if}
	{#if form?.successMessage}<p role="status" class="mb-4 alert alert-success">
			{form.successMessage}
		</p>{/if}
	{#if reauth === 'ok'}
		<p role="status" class="mb-4 alert alert-success">
			Identity confirmed. You can now update your password.
		</p>
	{:else if reauth === 'failed'}
		<p role="alert" class="mb-4 alert alert-error">
			That confirmation link is invalid or expired. Request a new one below.
		</p>
	{/if}
	<form
		method="POST"
		action={`?${resetToken ? `t=${encodeURIComponent(resetToken)}&` : ''}/save`}
		use:enhance
		class="flex flex-col gap-3"
	>
		<input type="hidden" name="token" value={resetToken} />
		{#if hasPassword && !resetToken}
			<label for="current-password">Current password</label>
			<input
				id="current-password"
				name="currentPassword"
				type="password"
				autocomplete="current-password"
				class="input-bordered input w-full"
				required
			/>
		{/if}
		<label for="new-password">New password</label>
		<input
			id="new-password"
			name="newPassword"
			type="password"
			autocomplete="new-password"
			minlength="8"
			maxlength="128"
			class="input-bordered input w-full"
			required
		/>
		<label for="confirm-password">Confirm new password</label>
		<input
			id="confirm-password"
			name="password2"
			type="password"
			autocomplete="new-password"
			minlength="8"
			maxlength="128"
			class="input-bordered input w-full"
			required
		/>
		<button type="submit" class="btn btn-primary">Save password</button>
	</form>
	{#if !resetToken && (form?.code === 'recent_auth_required' || reauth === 'failed')}
		<form method="POST" action="?/reauth" use:enhance class="mt-4">
			<button type="submit" class="btn btn-secondary">Email a confirmation link</button>
		</form>
	{/if}
	<a href="/forgot-password" class="mt-4 link">Request a new reset link</a>
</div>
