import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

const modes = [
	{ value: 'light', Icon: Sun, label: 'Light' },
	{ value: 'system', Icon: Monitor, label: 'System' },
	{ value: 'dark', Icon: Moon, label: 'Dark' }
] as const;
type ThemeMode = (typeof modes)[number]['value'];

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode | null>(null);
	useEffect(() => {
		const match = document.cookie.match(/(?:^|;\s*)theme=(system|light|dark)(?:;|$)/);
		const update = () => setMode((match?.[1] as ThemeMode) || 'system');
		update();
		const synchronize = (event: Event) => setMode((event as CustomEvent<ThemeMode>).detail);
		window.addEventListener('themechange', synchronize);
		return () => window.removeEventListener('themechange', synchronize);
	}, []);
	useEffect(() => {
		if (!mode) return;
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () =>
			document.documentElement.classList.toggle(
				'dark',
				mode === 'dark' || (mode === 'system' && media.matches)
			);
		apply();
		if (mode === 'system') {
			media.addEventListener('change', apply);
			return () => media.removeEventListener('change', apply);
		}
	}, [mode]);

	function select(next: ThemeMode) {
		document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
		window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
	}

	return (
		<div className="inline-flex overflow-hidden rounded-full border border-base-content/20 align-middle text-xs">
			{modes.map(({ value, Icon, label }) => (
				<button
					key={value}
					type="button"
					aria-label={`Use ${value} theme`}
					disabled={mode === null}
					aria-pressed={(mode ?? 'system') === value}
					title={label}
					className={`flex h-8 w-8 items-center justify-center transition-colors ${value === 'system' ? 'border-x border-base-content/20' : ''} ${(mode ?? 'system') === value ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}
					onClick={() => select(value)}
				>
					<Icon className="h-4 w-4" />
				</button>
			))}
		</div>
	);
}
