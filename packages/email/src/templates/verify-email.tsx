import * as React from 'react';
import { Html, Head, Body, Text, Button, Img, Heading, Container, Preview } from 'react-email';

export interface VerifyEmailProps {
	pin: string;
	appUrl?: string;
}

export default function VerifyEmail({
	pin = '0t0k3n',
	appUrl = 'https://www.ak5web.com'
}: VerifyEmailProps) {
	const buttonUrl = `${appUrl}/account/verify`;
	const currentYear = new Date().getFullYear();

	return (
		<Html lang="en">
			<Head />
			<Preview children="ak5-web - Verify Email" />
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
						Enter the code on the verification page to verify your email address.
					</Text>
					<Text style={{ marginBottom: '16px', textAlign: 'center' }}>
						The code is valid for one hour.
					</Text>
					<Text
						style={{
							marginBottom: '16px',
							textAlign: 'center',
							fontSize: '20px',
							fontWeight: '500'
						}}
					>
						Your verification PIN:
					</Text>
					<div
						style={{
							marginBottom: '16px',
							padding: '16px',
							backgroundColor: '#f3f4f6',
							borderRadius: '8px',
							border: '1px solid #e5e7eb',
							textAlign: 'center'
						}}
					>
						<Text
							style={{
								marginBottom: '8px',
								textAlign: 'center',
								fontFamily: 'monospace',
								fontSize: '30px',
								fontWeight: 'bold',
								color: '#2563eb'
							}}
						>
							{pin}
						</Text>
						<Text
							style={{
								textAlign: 'center',
								fontSize: '12px',
								color: '#6b7280',
								fontStyle: 'italic'
							}}
						>
							Copy pin above and enter it on the website
						</Text>
					</div>
					<div style={{ textAlign: 'center', marginBottom: '16px' }}>
						<Button
							href={buttonUrl}
							style={{
								width: 'auto',
								maxWidth: '100%',
								borderRadius: '6px',
								backgroundColor: '#2563eb',
								padding: '16px 32px',
								textAlign: 'center',
								fontWeight: 'bold',
								color: 'white',
								textDecoration: 'none',
								display: 'inline-block'
							}}
						>
							Back to ak5-web
						</Button>
					</div>
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

VerifyEmail.PreviewProps = {
	pin: '0t0k3n',
	appUrl: 'https://www.ak5web.com'
};
