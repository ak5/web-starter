<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="card mx-auto max-w-md bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Verify your email</h1>
	<p class="mb-4">Enter the code from your email. You can request a new code below.</p>
	{#if form?.error}
		<p role="alert" class="mb-4 alert alert-error">{form.error}</p>
	{:else if data.deliverySent}
		<p role="status" class="mb-4 alert alert-success">A new code has been sent.</p>
	{:else if data.deliveryFailed}
		<p role="alert" class="mb-4 alert alert-error">
			Your account is ready, but we could not send the verification email. Please try resending
			later.
		</p>
	{/if}
	<form method="POST" action="?/verify" use:enhance class="flex flex-col gap-3">
		<label for="pin">Verification code</label>
		<input id="pin" name="pin" autocomplete="one-time-code" class="input-bordered input" required />
		<button type="submit" class="btn btn-primary">Verify email</button>
	</form>
	<form method="POST" action="?/resend" use:enhance class="mt-4">
		<button type="submit" class="btn btn-secondary">Resend verification email</button>
	</form>
</div>
