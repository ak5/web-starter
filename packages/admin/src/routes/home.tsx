import Modal from '@ak5/webui/components/Modal';
import Pagination from '@ak5/webui/components/Pagination';
import type { Route } from './+types/home';
import { useEffect, useState } from 'react';
import { data, Form, useNavigation } from 'react-router';
import { createInvite, loadUsers } from '../lib/users.server';

export const loader = loadUsers;
export const headers = () => ({ 'Cache-Control': 'no-store' });
export async function action(event: Route.ActionArgs) {
	return data(await createInvite(event), { headers: { 'Cache-Control': 'no-store' } });
}

export default function Users({ loaderData: page, actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const [inviteRole, setInviteRole] = useState('user');
	const [copiedUrl, setCopiedUrl] = useState('');
	const [inviteOpen, setInviteOpen] = useState(false);
	const [previousInvite, setPreviousInvite] = useState(actionData);
	const invite = inviteOpen && actionData !== previousInvite ? actionData : undefined;
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
		<section className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-(--toolbar-gap)">
				<h1 className="text-2xl font-semibold">Users</h1>
				<button
					type="button"
					className="ui-button ui-button-primary"
					disabled={navigation.state !== 'idle'}
					onClick={() => {
						setPreviousInvite(actionData);
						setCopiedUrl('');
						setInviteRole('user');
						setInviteOpen(true);
					}}
				>
					Invite
				</button>
			</div>
			<div className="mb-6">
				<AccountTable title="Regular users" rows={page.users} empty="No users yet." />
				<Pagination pagination={page.pagination} />
			</div>
			<AccountTable
				title="Admins"
				rows={page.admins.map((admin) => ({
					...admin,
					role: 'Admin',
					statusLabel: admin.emailVerified ? 'Verified' : 'Unverified'
				}))}
				empty="No admins yet."
			/>
			<Modal open={inviteOpen} title="Invite someone" onClose={() => setInviteOpen(false)}>
				{inviteOpen && (
					<>
						<Form method="post" className="grid gap-3">
							<label htmlFor="invite-email">Email</label>
							<input
								id="invite-email"
								name="email"
								type="email"
								required
								className="ui-field w-full"
							/>
							<label htmlFor="invite-username">Username</label>
							<input
								id="invite-username"
								name="username"
								pattern="[A-Za-z0-9_]{5,20}"
								required
								className="ui-field w-full"
								aria-describedby="invite-username-help"
							/>
							<p id="invite-username-help" className="text-sm">
								Use 5–20 letters, numbers, or underscores.
							</p>
							<label htmlFor="invite-role">Role</label>
							<select
								id="invite-role"
								name="role"
								className="ui-field w-full"
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
									className="ui-button ui-button-primary"
									disabled={navigation.state !== 'idle'}
								>
									Send email invite
								</button>
								<button
									name="delivery"
									value="link"
									className="ui-button"
									disabled={inviteRole === 'admin' || navigation.state !== 'idle'}
								>
									Create and copy invite link
								</button>
							</div>
						</Form>
						{invite?.error && (
							<p role="alert" className="mt-4">
								{invite.error}
							</p>
						)}
						{invite && !invite.error && !invite.inviteUrl && (
							<p role="status" className="mt-4">
								Invitation sent.
							</p>
						)}
						{inviteUrl && (
							<div className="mt-4 grid gap-2">
								<label htmlFor="invite-url">One-time invite link</label>
								<input
									id="invite-url"
									className="ui-field w-full"
									readOnly
									value={inviteUrl}
									onFocus={(event) => event.currentTarget.select()}
								/>
								{copiedUrl !== inviteUrl && (
									<button
										type="button"
										className="ui-button w-fit"
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
									Share privately. This link expires after seven days and leaves the email
									unverified.
								</p>
							</div>
						)}
					</>
				)}
			</Modal>
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
			<table className="ui-table">
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
							<td colSpan={4} className="text-center text-ink/60">
								{empty}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
