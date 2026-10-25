<script lang="ts">
	import { Text, Section, Button } from '@better-svelte-email/components';
	import { styleToString } from '@better-svelte-email/components/utils';
	import EmailLayout from '../components/EmailLayout.svelte';
	import type { VerifyEmailProps } from '../types.js';
	import { text, compactButton, footnote } from '../styles.js';
	let { pin = '0t0k3n', appUrl = 'https://www.ak5web.com' }: VerifyEmailProps = $props();
</script>

<EmailLayout preview="ak5-web - Verify Email">
	<Text style={text}>Enter the code on the verification page to verify your email address.</Text>
	<Text style={text}>The code is valid for one hour.</Text>
	<Text
		style={styleToString({
			marginBottom: '16px',
			textAlign: 'center',
			fontSize: '20px',
			fontWeight: '500'
		})}>Your verification PIN:</Text
	>
	<Section
		style={styleToString({
			marginBottom: '16px',
			padding: '16px',
			backgroundColor: '#f3f4f6',
			borderRadius: '8px',
			border: '1px solid #e5e7eb',
			textAlign: 'center'
		})}
	>
		<Text
			style={styleToString({
				marginBottom: '8px',
				textAlign: 'center',
				fontFamily: 'monospace',
				fontSize: '30px',
				fontWeight: 'bold',
				color: '#2563eb'
			})}>{pin}</Text
		>
		<Text
			style={styleToString({
				textAlign: 'center',
				fontSize: '12px',
				color: '#6b7280',
				fontStyle: 'italic'
			})}>Copy pin above and enter it on the website</Text
		>
	</Section>
	<Section style={text}>
		<Button href={`${appUrl}/account/verify`} style={compactButton} pY={16} pX={32}
			>Back to ak5-web</Button
		>
	</Section>
	<Text style={footnote}>If you didn't request this change, please ignore this email.</Text>
</EmailLayout>
