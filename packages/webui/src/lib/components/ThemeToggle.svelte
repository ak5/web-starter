<script lang="ts">
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	type ThemeMode = 'system' | 'light' | 'dark';

	let mode = $state<ThemeMode>('system');

	$effect(() => {
		const match = document.cookie.match(/theme=(system|light|dark)/);
		mode = (match?.[1] as ThemeMode) || 'system';
	});

	function prefersDark(): boolean {
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	function applyTheme(themeMode: ThemeMode) {
		const isDark = themeMode === 'system' ? prefersDark() : themeMode === 'dark';
		document.documentElement.classList.toggle('dark', isDark);
	}

	$effect(() => {
		applyTheme(mode);
	});

	$effect(() => {
		if (mode === 'system') {
			const mq = window.matchMedia('(prefers-color-scheme: dark)');
			const handler = () => applyTheme('system');
			mq.addEventListener('change', handler);
			return () => mq.removeEventListener('change', handler);
		}
	});

	function setTheme(newMode: ThemeMode) {
		mode = newMode;
		document.cookie = `theme=${newMode}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
	}
</script>

<div
	class="inline-flex overflow-hidden rounded-full border border-base-content/20 align-middle text-xs"
>
	<button
		type="button"
		aria-label="Use light theme"
		title="Light"
		class="flex h-8 w-8 items-center justify-center transition-colors {mode === 'light'
			? 'bg-primary text-primary-content'
			: 'hover:bg-base-300'}"
		onclick={() => setTheme('light')}
	>
		<SunIcon class="h-4 w-4" />
	</button>
	<button
		type="button"
		aria-label="Use system theme"
		title="System"
		class="flex h-8 w-8 items-center justify-center border-x border-base-content/20 transition-colors {mode ===
		'system'
			? 'bg-primary text-primary-content'
			: 'hover:bg-base-300'}"
		onclick={() => setTheme('system')}
	>
		<MonitorIcon class="h-4 w-4" />
	</button>
	<button
		type="button"
		aria-label="Use dark theme"
		title="Dark"
		class="flex h-8 w-8 items-center justify-center transition-colors {mode === 'dark'
			? 'bg-primary text-primary-content'
			: 'hover:bg-base-300'}"
		onclick={() => setTheme('dark')}
	>
		<MoonIcon class="h-4 w-4" />
	</button>
</div>
