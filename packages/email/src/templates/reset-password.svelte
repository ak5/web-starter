<script lang="ts">
	import { Text, Button } from '@better-svelte-email/components';
	import EmailLayout from '../components/EmailLayout.svelte';
	import type { ResetPasswordProps } from '../types.js';
	import { text, fullButton, footnote } from '../styles.js';
	let { token = 'reset-token-example', appUrl = 'https://www.ak5web.com' }: ResetPasswordProps =
		$props();
</script>

<EmailLayout preview="ak5-web - Reset Password">
	<Text style={text}>Click the button below to reset your password</Text>
	<Text style={text}>It is only valid for a short time</Text>
	<Button href={`${appUrl}/account/password?t=${token}`} style={fullButton} pX={16} pY={16}
		>Reset Password</Button
	>
	<Text style={footnote}>If you didn't request this change, please ignore this email.</Text>
</EmailLayout>
