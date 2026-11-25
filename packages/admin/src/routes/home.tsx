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
				<h2 className="text-lg font-semibold">Invite a user</h2>
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
						disabled={navigation.state !== 'idle'}
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
						{page.users.length ? (
							page.users.map((user) => (
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
