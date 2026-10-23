import * as React from 'react';
import { Html, Head, Body, Text, Button, Img, Heading, Container, Preview } from 'react-email';

export interface ResetPasswordProps {
	token: string;
	appUrl?: string;
}

export default function ResetPassword({
	token,
	appUrl = 'https://www.ak5web.com'
}: ResetPasswordProps) {
	const buttonUrl = `${appUrl}/account/password?t=${token}`;
	const currentYear = new Date().getFullYear();

	return (
		<Html lang="en">
			<Head />
			<Preview children="ak5-web - Reset Password" />
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
						ak5-web
					</Heading>
					<Text style={{ marginBottom: '16px', textAlign: 'center' }}>
						Click the button below to reset your password
					</Text>
					<Text style={{ marginBottom: '16px', textAlign: 'center' }}>
						It is only valid for a short time
					</Text>
					<Button
						href={buttonUrl}
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
						Reset Password
					</Button>
					<Text
						style={{
							marginTop: '16px',
							textAlign: 'center',
							fontSize: '14px',
							color: '#4b5563'
						}}
					>
						If you didn't request this change, please ignore this email.
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
				</Container>
			</Body>
		</Html>
	);
}

ResetPassword.PreviewProps = {
	token: 'reset-token-example',
	appUrl: 'https://www.ak5web.com'
};
