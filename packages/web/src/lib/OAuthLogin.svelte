<script lang="ts">
	import { PUBLIC_API_URL } from '$app/env/public';
	import IconSocial from '@ak5/webui/components/IconSocial.svelte';

	// The API owns the OAuth handshake; the browser navigates straight to it and
	// is redirected back to the app once the JWT cookie is set. This component is
	// the removable `auth-oauth` overlay's only frontend surface — `--no-oauth`
	// deletes it (and its usages) wholesale.
	const discordUrl = `${PUBLIC_API_URL}/oauth/discord`;
</script>

<div class="divider my-4 text-xs text-base-content/50">or</div>
<a href={discordUrl} class="btn w-full gap-2 btn-outline" rel="external">
	<IconSocial platform="discord" size="lg" />
	Continue with Discord
</a>
