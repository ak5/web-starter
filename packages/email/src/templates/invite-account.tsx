import * as React from 'react';
import { Html, Head, Body, Text, Button, Img, Heading, Container, Preview } from 'react-email';

export interface InviteAccountProps {
	inviteUrl: string;
	role?: 'user' | 'admin';
	appUrl?: string;
}

export default function InviteAccount({
	inviteUrl,
	role = 'user',
	appUrl = 'https://www.ak5web.com'
}: InviteAccountProps) {
	const currentYear = new Date().getFullYear();
	const roleLabel = role === 'admin' ? 'admin' : 'ak5-web';

	return (
		<Html lang="en">
			<Head />
			<Preview children={`ak5-web - ${roleLabel} invitation`} />
			<Body style={{ fontFamily: 'sans-serif', color: '#1f2937' }}>
				<Container
					style={{
						margin: '0 auto',
						marginTop: '24px',
						marginBottom: '24px',
						maxWidth: '448px',
						borderRadius: '8px',
						border: '2px solid #4b5563',
						padding: '24px',
						boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
					}}
				>
					<Img
						src="https://www.ak5web.com/logo.png"
						alt="Logo"
						style={{
							margin: '0 auto',
							marginBottom: '24px',
							display: 'block'
						}}
						width="100"
						height="100"
					/>
					<Heading
						as="h1"
						style={{
							margin: '20px 0',
							textAlign: 'center',
							fontFamily: 'sans-serif',
							fontSize: '24px',
							color: '#1f2937'
						}}
					>
						You're invited to ak5-web
					</Heading>
					<Text style={{ marginBottom: '16px', textAlign: 'center' }}>
						An administrator created a {roleLabel} account for you.
					</Text>
					<Text style={{ marginBottom: '16px', textAlign: 'center' }}>
						Accept the invite and set your password. This link expires in 7 days.
					</Text>
					<Button
						href={inviteUrl}
						style={{
							width: '100%',
							maxWidth: '100%',
							boxSizing: 'border-box',
							borderRadius: '6px',
							backgroundColor: '#2563eb',
							padding: '16px',
							textAlign: 'center',
							fontWeight: 'bold',
							color: 'white',
							textDecoration: 'none',
							display: 'block'
						}}
					>
						Accept Invite
					</Button>
					<Text
						style={{
							marginTop: '16px',
							textAlign: 'center',
							fontSize: '14px',
							color: '#4b5563'
						}}
					>
						If you were not expecting this invite, you can ignore this email.
					</Text>
					<Text
						style={{
							marginTop: '16px',
							textAlign: 'center',
							fontSize: '14px',
							color: '#6b7280'
						}}
					>
						© {currentYear} ak5-web. All rights reserved.
					</Text>
					<Text style={{ display: 'none' }}>{appUrl}</Text>
				</Container>
			</Body>
		</Html>
	);
}

InviteAccount.PreviewProps = {
	inviteUrl: 'https://www.ak5web.com/invite?t=invite-token-example',
	role: 'user',
	appUrl: 'https://www.ak5web.com'
};
