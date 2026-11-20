import { Text } from 'react-email';
import EmailButton from '../components/EmailButton.js';
import EmailLayout from '../components/EmailLayout.js';
import { footnote, text } from '../styles.js';
import type { ResetPasswordProps } from '../types.js';

export default function ResetPassword({
	token = 'reset-token-example',
	appUrl = 'https://www.ak5web.com'
}: ResetPasswordProps) {
	return (
		<EmailLayout preview="ak5-web - Reset Password">
			<Text style={text}>Click the button below to reset your password</Text>
			<Text style={text}>It is only valid for a short time</Text>
			<EmailButton href={`${appUrl}/account/password?t=${token}`}>Reset Password</EmailButton>
			<Text style={footnote}>If you didn't request this change, please ignore this email.</Text>
		</EmailLayout>
	);
}
