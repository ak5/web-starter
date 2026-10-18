<script>
	import IconSocial from './IconSocial.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let isDark = $state(false);

	$effect(() => {
		const update = () => {
			isDark = document.documentElement.classList.contains('dark');
		};
		update();
		const observer = new MutationObserver(() => {
			update();
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});
		return () => observer.disconnect();
	});
</script>

<footer class="bg-base-200 py-6 pb-20 text-base-content md:pb-6">
	<div class="container mx-auto px-4">
		<div class="mb-4 flex flex-col items-center justify-center">
			<div>
				<div class="mb-6 flex flex-col items-center">
					<a href="/" class="flex flex-col items-center">
						<div class="relative mb-2 h-16 w-16">
							<img src="/logo.png" alt="ak5-web Icon" class="object-contain" />
						</div>
						<span
							class="text-3xl font-bold text-secondary transition-all duration-300 hover:text-primary"
						>
							ak5-web
						</span>
					</a>
				</div>
				<p class="mb-6 text-center text-base-content/60">Your tagline goes here.</p>
				<!-- Replace these with your own social links (or delete the row). -->
				<div class="flex justify-center space-x-4">
					<IconSocial
						platform="x"
						url="https://x.com/yourhandle"
						color={isDark ? 'white' : 'black'}
					/>
					<IconSocial platform="youtube" url="https://www.youtube.com/@yourhandle" />
				</div>
			</div>
		</div>

		<div class="space-y-2 border-t border-base-content/20 pt-4 text-center">
			<div class="text-sm">
				<a href="/terms-of-service" class="text-primary hover:underline">terms</a>
				<span class="mx-2">|</span>
				<a href="/privacy" class="text-primary hover:underline">privacy</a>
				<span class="mx-2">|</span>
				<ThemeToggle />
			</div>
			<p class="text-xs text-base-content/60">
				&copy; {new Date().getFullYear()} ak5-web. All rights reserved.
			</p>
		</div>
	</div>
</footer>
