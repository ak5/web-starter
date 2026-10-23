<script lang="ts">
	import { onMount } from 'svelte';

	const GA_ID = 'G-KWP7ED0FBP';

	onMount(() => {
		if (typeof window === 'undefined') return;
		if (document.getElementById('google-analytics')) return;

		const script = document.createElement('script');
		script.id = 'google-analytics';
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
		document.head.appendChild(script);

		const inlineScript = document.createElement('script');
		inlineScript.innerHTML = `
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		gtag('js', new Date());
		gtag('config', '${GA_ID}');
	`;
		document.head.appendChild(inlineScript);
	});
</script>
