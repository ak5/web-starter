<script lang="ts">
	let { data } = $props();
</script>

<section class="hero min-h-[70vh]">
	<div class="hero-content text-center">
		<div class="max-w-md">
			<h1 class="text-5xl font-bold">ak5-web</h1>
			<p class="py-6 text-base-content/70">
				A batteries-included full-stack starter — Hono API, split SvelteKit apps, Cloudflare D1,
				auth. Replace this landing page with your product.
			</p>
			{#if data.auth}
				<a href="/dashboard" class="btn btn-primary">Go to your dashboard</a>
			{:else}
				<div class="flex justify-center gap-3">
					<a href="/register" class="btn btn-primary">Get started</a>
					<a href="/login" class="btn btn-ghost">Sign in</a>
				</div>
			{/if}
		</div>
	</div>
</section>

<footer class="py-6 text-center text-sm text-base-content/70">
	Made with &lt;3 by <a class="link" href="https://alexander.verver.is">ak5</a>
</footer>
