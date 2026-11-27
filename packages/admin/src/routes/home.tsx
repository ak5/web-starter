import type { Route } from './+types/home';
import { useEffect, useState } from 'react';
import { data, Form, useNavigation } from 'react-router';
import { createInvite, loadUsers } from '../lib/users.server';

export const loader = loadUsers;
export const headers = () => ({ 'Cache-Control': 'no-store' });
export async function action(event: Route.ActionArgs) {
	return data(await createInvite(event), { headers: { 'Cache-Control': 'no-store' } });
}

export default function Users({ loaderData: page, actionData: invite }: Route.ComponentProps) {
	const navigation = useNavigation();
	const [inviteRole, setInviteRole] = useState('user');
	const [copiedUrl, setCopiedUrl] = useState('');
	const inviteUrl = invite?.inviteUrl;

	useEffect(() => {
		if (!inviteUrl || !navigator.clipboard) return;
		let current = true;
		navigator.clipboard.writeText(inviteUrl).then(
			() => {
				if (current) setCopiedUrl(inviteUrl);
			},
			() => {
				// The visible link and copy button are available if the browser denies automatic copying.
			}
		);
		return () => {
			current = false;
		};
	}, [inviteUrl]);
	return (
		<section className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-3xl font-bold">Users</h1>
			<Form method="post" className="mb-8 grid max-w-lg gap-3">
				<h2 className="text-lg font-semibold">Invite someone</h2>
				<label htmlFor="invite-email">Email</label>
				<input id="invite-email" name="email" type="email" required className="input w-full" />
				<label htmlFor="invite-username">Username</label>
				<input
					id="invite-username"
					name="username"
					pattern="[A-Za-z0-9_]{5,20}"
					required
					className="input w-full"
					aria-describedby="invite-username-help"
				/>
				<p id="invite-username-help" className="text-sm">
					Use 5–20 letters, numbers, or underscores.
				</p>
				<label htmlFor="invite-role">Role</label>
				<select
					id="invite-role"
					name="role"
					className="select w-full"
					value={inviteRole}
					onChange={(event) => setInviteRole(event.currentTarget.value)}
					aria-describedby="invite-role-help"
				>
					<option value="user">User</option>
					<option value="admin">Admin</option>
				</select>
				<p id="invite-role-help" className="text-sm">
					Admin invitations must be sent by email.
				</p>
				<div className="flex flex-wrap gap-2">
					<button
						name="delivery"
						value="email"
						className="btn btn-primary"
						disabled={navigation.state !== 'idle'}
					>
						Send email invite
					</button>
					<button
						name="delivery"
						value="link"
						className="btn"
						disabled={inviteRole === 'admin' || navigation.state !== 'idle'}
					>
						Create and copy invite link
					</button>
				</div>
			</Form>
			{invite?.error && (
				<p role="alert" className="mb-6">
					{invite.error}
				</p>
			)}
			{invite && !invite.error && !invite.inviteUrl && (
				<p role="status" className="mb-6">
					Invitation sent.
				</p>
			)}
			{inviteUrl && (
				<div className="mb-6 grid max-w-lg gap-2">
					<label htmlFor="invite-url">One-time invite link</label>
					<input
						id="invite-url"
						className="input w-full"
						readOnly
						value={inviteUrl}
						onFocus={(event) => event.currentTarget.select()}
					/>
					{copiedUrl !== inviteUrl && (
						<button
							type="button"
							className="btn w-fit"
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(inviteUrl);
									setCopiedUrl(inviteUrl);
								} catch {
									document.getElementById('invite-url')?.focus();
								}
							}}
						>
							Copy invite link
						</button>
					)}
					{copiedUrl === inviteUrl && <p role="status">Invite link copied.</p>}
					<p className="text-sm">
						Share privately. This link expires after seven days and leaves the email unverified.
					</p>
				</div>
			)}
			<AccountTable title="Regular users" rows={page.users} empty="No users yet." />
			<AccountTable
				title="Admins"
				rows={page.admins.map((admin) => ({
					...admin,
					role: 'Admin',
					statusLabel: admin.emailVerified ? 'Verified' : 'Unverified'
				}))}
				empty="No admins yet."
			/>
		</section>
	);
}

function AccountTable({
	title,
	rows,
	empty
}: {
	title: string;
	rows: {
		publicId: string;
		username: string;
		email: string | null;
		role: string;
		statusLabel: string;
	}[];
	empty: string;
}) {
	return (
		<div className="mb-6 overflow-x-auto">
			<table className="table">
				<caption className="mb-2 text-left text-lg font-semibold">{title}</caption>
				<thead>
					<tr>
						<th scope="col">Username</th>
						<th scope="col">Email</th>
						<th scope="col">Role</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.publicId}>
							<td>{row.username}</td>
							<td>{row.email}</td>
							<td>{row.role}</td>
							<td>{row.statusLabel}</td>
						</tr>
					))}
					{rows.length === 0 && (
						<tr>
							<td colSpan={4} className="text-center text-base-content/60">
								{empty}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
