<script lang="ts">
	let { data } = $props();
</script>

<section class="mx-auto max-w-2xl p-8">
	<h1 class="text-3xl font-bold">You're signed in 🎉</h1>
	<p class="py-4 text-base-content/70">
		This is a protected route. Replace it with your application.
	</p>
	<div class="card flex flex-col gap-1 bg-base-200 p-4">
		<p><span class="font-semibold">User:</span> {data.viewer?.username}</p>
		<p><span class="font-semibold">Email:</span> {data.viewer?.email}</p>
		<p>
			<span class="font-semibold">Email verified:</span>
			{data.viewer?.emailVerified ? 'yes' : 'no'}
		</p>
	</div>
	{#if !data.viewer?.emailVerified}
		<a href="/account/verify" class="mt-4 inline-block link"
			>Verify your email or request a new code</a
		>
	{/if}
	<p class="mt-6 text-sm text-base-content/60">Sign out from the top bar.</p>
</section>
