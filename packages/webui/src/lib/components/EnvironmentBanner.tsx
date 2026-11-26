import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

export default function EnvironmentBanner({ environment }: { environment?: string }) {
	const { key } = useLocation();
	return environment ? <Banner key={key} environment={environment} /> : null;
}

function Banner({ environment }: { environment: string }) {
	const [dismissed, setDismissed] = useState(false);
	const [ready, setReady] = useState(false);
	useEffect(() => setReady(true), []);
	if (dismissed) return null;
	return (
		<aside
			aria-label="Environment"
			className="flex items-center justify-between gap-4 bg-warning px-4 py-2 text-sm text-warning-content"
		>
			<span>
				<strong>{environment}</strong> environment
			</span>
			<button
				type="button"
				className="btn btn-ghost btn-xs"
				aria-label="Dismiss environment banner"
				disabled={!ready}
				onClick={() => setDismissed(true)}
			>
				Dismiss
			</button>
		</aside>
	);
}
