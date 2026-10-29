<script lang="ts">
	import PasswordForm from '@ak5/webui/components/PasswordForm.svelte';
	let { data, form } = $props();
</script>

<PasswordForm
	form={form ?? data.connectionError}
	resetToken={data.resetToken}
	hasPassword={data.auth?.hasPassword ?? false}
	reauth={data.reauth}
/>

{#if data.connection === 'discord'}
	<p role="status" class="mx-auto alert max-w-md alert-success">Discord login connected.</p>
{/if}
