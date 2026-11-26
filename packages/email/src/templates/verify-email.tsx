import { Section, Text } from 'react-email';
import EmailButton from '../components/EmailButton.js';
import EmailLayout from '../components/EmailLayout.js';
import { footnote, text } from '../styles.js';
import type { VerifyEmailProps } from '../types.js';

export default function VerifyEmail({
	pin = '0t0k3n',
	appUrl = 'https://www.ak5web.com'
}: VerifyEmailProps) {
	return (
		<EmailLayout preview="ak5-web - Verify Email">
			<Text style={text}>
				Enter the code on the verification page to verify your email address.
			</Text>
			<Text style={text}>The code is valid for one hour.</Text>
			<Text style={{ ...text, fontSize: '20px', fontWeight: 500 }}>Your verification PIN:</Text>
			<Section
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
						...text,
						marginBottom: '8px',
						fontFamily: 'monospace',
						fontSize: '30px',
						fontWeight: 'bold',
						color: '#2563eb'
					}}
				>
					{pin}
				</Text>
				<Text style={{ ...text, fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
					Copy pin above and enter it on the website
				</Text>
			</Section>
			<Section style={{ marginBottom: '16px', textAlign: 'center' }}>
				<EmailButton href={`${appUrl}/account/verify`} compact>
					Back to ak5-web
				</EmailButton>
			</Section>
			<Text style={footnote}>If you didn't request this change, please ignore this email.</Text>
		</EmailLayout>
	);
}
