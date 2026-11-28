import { Text } from 'react-email';
import EmailLayout from '../components/EmailLayout.js';
import { text } from '../styles.js';

export default function EmailChange({ code }: { code?: string }) {
	return (
		<EmailLayout preview={code ? 'Confirm your email change' : 'Your sign-in email changed'}>
			{code ? (
				<Text style={text}>
					Enter this code in your account settings within ten minutes: <strong>{code}</strong>
				</Text>
			) : (
				<Text style={text}>
					Your sign-in email address changed. Contact support if you did not make this change.
				</Text>
			)}
		</EmailLayout>
	);
}
