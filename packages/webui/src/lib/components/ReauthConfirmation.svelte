<script lang="ts">
	import { enhance } from '$app/forms';
</script>

<svelte:head><title>Confirm your identity</title></svelte:head>
<div class="card mx-auto my-8 max-w-md bg-base-200 p-6">
	<h1 class="mb-4 text-2xl font-bold">Confirm your identity</h1>
	<p class="mb-4">Continue to confirm this session before updating your password.</p>
	<form method="POST" use:enhance>
		<button type="submit" class="btn btn-primary">Confirm and continue</button>
	</form>
</div>
