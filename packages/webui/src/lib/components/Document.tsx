import type { ReactNode } from 'react';
import { Links, Meta, Scripts, ScrollRestoration } from 'react-router';
import { themeScript } from '../theme-script.js';

export default function Document({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="color-scheme" content="light dark" />
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<Meta />
				{/* Stylesheets are same-origin and need no script nonce. */}
				<Links nonce="" />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
