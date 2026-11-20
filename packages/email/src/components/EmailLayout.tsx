import type { ReactNode } from 'react';
import { Body, Container, Head, Heading, Html, Img, Preview, Text } from 'react-email';
import { body, container, footer, heading, logo } from '../styles.js';

export default function EmailLayout({
	preview,
	title = 'ak5-web',
	children
}: {
	preview: string;
	title?: string;
	children: ReactNode;
}) {
	return (
		<Html lang="en" dir="ltr">
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			</Head>
			<Preview>{preview}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Img
						src="https://www.ak5web.com/logo.png"
						alt="Logo"
						style={logo}
						width={100}
						height={100}
						fetchPriority="low"
					/>
					<Heading as="h1" style={heading}>
						{title}
					</Heading>
					{children}
					<Text style={footer}>© {new Date().getFullYear()} ak5-web. All rights reserved.</Text>
				</Container>
			</Body>
		</Html>
	);
}
