<script lang="ts">
	import { Text, Button } from '@better-svelte-email/components';
	import EmailLayout from '../components/EmailLayout.svelte';
	import type { LoginWithProps } from '../types.js';
	import { text, fullButton } from '../styles.js';
	let {
		identities = [
			['discord', '13123412341234'],
			['email', 'test@test.com']
		],
		appUrl = 'https://www.ak5web.com'
	}: LoginWithProps = $props();
</script>

<EmailLayout preview="ak5-web - Account Access Attempt">
	<Text style={text}>Someone is trying to access your account.</Text>
	<Text style={text}>If this was you, continue with the secure link below.</Text>
	<Text style={text}>Your login methods are:</Text>
	{#each identities as [provider, providerUserId], index (index)}
		<Text style={text}>{provider}: {providerUserId}</Text>
	{/each}
	<Button href={appUrl} style={fullButton} pX={16} pY={16}>Continue to ak5-web</Button>
</EmailLayout>
