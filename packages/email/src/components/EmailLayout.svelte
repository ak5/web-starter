<script lang="ts">
	import {
		Html,
		Head,
		Preview,
		Body,
		Container,
		Img,
		Heading,
		Text
	} from '@better-svelte-email/components';
	import type { Snippet } from 'svelte';
	import { body, container, logo, heading, footer } from '../styles.js';
	let {
		preview,
		title = 'ak5-web',
		children
	}: { preview: string; title?: string; children: Snippet } = $props();
</script>

<Html lang="en">
	<Head />
	<Preview {preview} />
	<Body style={body}>
		<Container style={container}>
			<Img src="https://www.ak5web.com/logo.png" alt="Logo" style={logo} width="100" height="100" />
			<Heading as="h1" style={heading}>{title}</Heading>
			{@render children()}
			<Text style={footer}>© {new Date().getFullYear()} ak5-web. All rights reserved.</Text>
		</Container>
	</Body>
</Html>
