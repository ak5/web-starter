import type { ReactNode } from 'react';
import { Button } from 'react-email';

export default function EmailButton({
	href,
	children,
	compact = false
}: {
	href: string;
	children: ReactNode;
	compact?: boolean;
}) {
	return (
		<Button
			href={href}
			style={{
				lineHeight: '100%',
				textDecoration: 'none',
				display: compact ? 'inline-block' : 'block',
				width: compact ? 'auto' : '100%',
				maxWidth: '100%',
				boxSizing: 'border-box',
				padding: compact ? '16px 32px' : '16px',
				borderRadius: '6px',
				backgroundColor: '#2563eb',
				textAlign: 'center',
				fontWeight: 'bold',
				color: 'white'
			}}
		>
			{children}
		</Button>
	);
}
