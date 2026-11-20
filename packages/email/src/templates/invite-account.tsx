import { Text } from 'react-email';
import EmailButton from '../components/EmailButton.js';
import EmailLayout from '../components/EmailLayout.js';
import { footnote, text } from '../styles.js';
import type { InviteAccountProps } from '../types.js';

export default function InviteAccount({
	inviteUrl = 'https://www.ak5web.com/invite?t=invite-token-example',
	role = 'user',
	appUrl = 'https://www.ak5web.com'
}: InviteAccountProps) {
	const roleLabel = role === 'admin' ? 'admin' : 'ak5-web';
	return (
		<EmailLayout preview={`ak5-web - ${roleLabel} invitation`} title="You're invited to ak5-web">
			<Text style={text}>An administrator created a {roleLabel} account for you.</Text>
			<Text style={text}>
				Accept the invite and set your password. This link expires in 7 days.
			</Text>
			<EmailButton href={inviteUrl}>Accept Invite</EmailButton>
			<Text style={footnote}>
				If you were not expecting this invite, you can ignore this email.
			</Text>
			<Text style={{ display: 'none' }}>{appUrl}</Text>
		</EmailLayout>
	);
}
