import { Text } from 'react-email';
import EmailButton from '../components/EmailButton.js';
import EmailLayout from '../components/EmailLayout.js';
import { text } from '../styles.js';
import type { LoginWithProps } from '../types.js';

export default function LoginWith({
	identities = [
		['discord', '13123412341234'],
		['email', 'test@test.com']
	],
	appUrl = 'https://www.ak5web.com'
}: LoginWithProps) {
	return (
		<EmailLayout preview="ak5-web - Account Access Attempt">
			<Text style={text}>Someone is trying to access your account.</Text>
			<Text style={text}>If this was you, continue with the secure link below.</Text>
			<Text style={text}>Your login methods are:</Text>
			{identities.map(([provider, providerUserId], index) => (
				<Text key={index} style={text}>
					{provider}: {providerUserId}
				</Text>
			))}
			<EmailButton href={appUrl}>Continue to ak5-web</EmailButton>
		</EmailLayout>
	);
}
