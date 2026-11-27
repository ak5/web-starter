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
		document.documentElement.dataset.theme = mode;
	}, [mode]);

	function select(next: ThemeMode) {
		document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
		window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
	}

	return (
		<div className="inline-flex overflow-hidden rounded-full border border-ink/20 align-middle text-xs">
			{modes.map(({ value, Icon, label }) => (
				<button
					key={value}
					type="button"
					aria-label={`Use ${value} theme`}
					disabled={mode === null}
					aria-pressed={(mode ?? 'system') === value}
					title={label}
					className={`flex size-(--control-height) items-center justify-center focus-visible:-outline-offset-4 focus-visible:outline-current ${value === 'system' ? 'border-x border-ink/20' : ''} ${(mode ?? 'system') === value ? 'bg-accent text-on-accent' : 'hover:bg-raised'}`}
					onClick={() => select(value)}
				>
					<Icon className="h-4 w-4" />
				</button>
			))}
		</div>
	);
}
