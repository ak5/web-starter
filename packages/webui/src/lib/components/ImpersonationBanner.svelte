<script lang="ts">
	type Props = {
		returnAction?: string;
	};

	const { returnAction = '/admin-return' }: Props = $props();
</script>

<div class="bg-warning py-1 text-center text-sm text-warning-content">
	Impersonating user -
	<form action={returnAction} method="POST" class="inline">
		<button type="submit" class="font-semibold underline">Return to Admin</button>
	</form>
</div>
