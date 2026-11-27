import type { ReactNode } from 'react';
import { Link } from 'react-router';
import ThemeToggle from './ThemeToggle.js';

export default function Navbar({
	brand = 'ak5-web',
	href = '/',
	actions
}: {
	brand?: string;
	href?: string;
	actions?: ReactNode;
}) {
	return (
		<header className="border-b border-surface bg-canvas py-2">
			<div className="container mx-auto flex flex-wrap items-center gap-2 px-4">
				<Link
					to={href}
					className="flex-1 text-xl font-bold tracking-tight text-ink hover:text-accent"
				>
					{brand}
				</Link>
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					{actions}
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
