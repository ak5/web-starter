<script lang="ts">
	import { Text, Button } from '@better-svelte-email/components';
	import EmailLayout from '../components/EmailLayout.svelte';
	import type { InviteAccountProps } from '../types.js';
	import { text, fullButton, footnote } from '../styles.js';
	let {
		inviteUrl = 'https://www.ak5web.com/invite?t=invite-token-example',
		role = 'user',
		appUrl = 'https://www.ak5web.com'
	}: InviteAccountProps = $props();
	let roleLabel = $derived(role === 'admin' ? 'admin' : 'ak5-web');
</script>

<EmailLayout preview={`ak5-web - ${roleLabel} invitation`} title="You're invited to ak5-web">
	<Text style={text}>An administrator created a {roleLabel} account for you.</Text>
	<Text style={text}>Accept the invite and set your password. This link expires in 7 days.</Text>
	<Button href={inviteUrl} style={fullButton} pX={16} pY={16}>Accept Invite</Button>
	<Text style={footnote}>If you were not expecting this invite, you can ignore this email.</Text>
	<Text style="display:none">{appUrl}</Text>
</EmailLayout>
