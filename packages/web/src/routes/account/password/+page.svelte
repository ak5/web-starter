<script lang="ts">
	import PasswordForm from '@ak5/webui/components/PasswordForm.svelte';
	let { data, form } = $props();
</script>

<PasswordForm
	{form}
	resetToken={data.resetToken}
	hasPassword={data.auth?.hasPassword ?? false}
	reauth={data.reauth}
/>
