<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="hero min-h-[60vh]">
	<div class="hero-content text-center">
		<div>
			<h1 class="text-4xl font-bold">{page.status}</h1>
			<p class="py-4 text-base-content/70">{page.error?.message ?? 'Something went wrong.'}</p>
			<a href="/" class="btn">Back home</a>
		</div>
	</div>
</section>
