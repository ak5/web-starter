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
			className="flex items-center justify-between gap-4 bg-caution px-4 py-2 text-sm text-on-caution"
		>
			<span>
				<strong>{environment}</strong> environment
			</span>
			<button
				type="button"
				className="min-h-(--control-height) cursor-pointer rounded-md px-3 font-semibold underline underline-offset-2 focus-visible:outline-current"
				aria-label="Dismiss environment banner"
				disabled={!ready}
				onClick={() => setDismissed(true)}
			>
				Dismiss
			</button>
		</aside>
	);
}
