<script lang="ts">
	let { data } = $props();
</script>

<section class="mx-auto max-w-4xl p-8">
	<h1 class="mb-6 text-3xl font-bold">Users</h1>
	<div class="overflow-x-auto">
		<table class="table">
			<thead>
				<tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th></tr>
			</thead>
			<tbody>
				{#each data.users as user (user.publicId)}
					<tr>
						<td>{user.username}</td>
						<td>{user.email}</td>
						<td>{user.role}</td>
						<td>{user.statusLabel}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="text-center text-base-content/60">No users yet.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
