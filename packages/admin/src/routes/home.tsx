import type { Route } from './+types/home';
import { loadUsers } from '../lib/users.server';

export const loader = loadUsers;

export default function Users({ loaderData: data }: Route.ComponentProps) {
	return (
		<section className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-3xl font-bold">Users</h1>
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>Username</th>
							<th>Email</th>
							<th>Role</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{data.users.length ? (
							data.users.map((user) => (
								<tr key={user.publicId}>
									<td>{user.username}</td>
									<td>{user.email}</td>
									<td>{user.role}</td>
									<td>{user.statusLabel}</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={4} className="text-center text-base-content/60">
									No users yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}
