import { DELETE_CONFIRMATION } from '@ak5/webui';
import ConfirmationDialog from '@ak5/webui/components/ConfirmationDialog';
import Modal from '@ak5/webui/components/Modal';
import Pagination from '@ak5/webui/components/Pagination';
import type { Route } from './+types/home';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { data, Form, useFetcher, useNavigation } from 'react-router';
import { createInvite, deleteUser, loadUsers, setUserBan } from '../lib/users.server';

export const loader = loadUsers;
export const headers = () => ({ 'Cache-Control': 'no-store' });
export async function action(event: Route.ActionArgs) {
	const form = await event.request.formData();
	const intent = form.get('intent');
	if (intent === 'delete-user') return deleteUser(event, form);
	if (intent === 'ban-user' || intent === 'unban-user') return setUserBan(event, form, intent);
	return data(await createInvite(event, form), { headers: { 'Cache-Control': 'no-store' } });
}

export default function Users({ loaderData: page, actionData }: Route.ComponentProps) {
	const heading = useRef<HTMLHeadingElement>(null);
	const [target, setTarget] = useState<{
		id: string;
		name: string;
		intent: 'delete-user' | 'ban-user' | 'unban-user';
	} | null>(null);
	const accountAction = useFetcher<typeof action>();
	const pending = accountAction.state !== 'idle';
	const deletedId =
		!pending && accountAction.data && 'deletedId' in accountAction.data
			? accountAction.data.deletedId
			: undefined;
	const updated =
		!pending && accountAction.data && 'updatedId' in accountAction.data
			? accountAction.data
			: undefined;
	const completedId = deletedId ?? updated?.updatedId;
	const deleting = target?.intent === 'delete-user';
	const banning = target?.intent === 'ban-user';
	const actionLabel = deleting ? 'Delete user' : banning ? 'Ban user' : 'Unban user';
	function selectAccountAction(
		id: string,
		name: string,
		intent: NonNullable<typeof target>['intent']
	) {
		accountAction.reset();
		setTarget({ id, name, intent });
	}
	const navigation = useNavigation();
	const [replacementId, setReplacementId] = useState('');
	const [inviteRole, setInviteRole] = useState('user');
	const [copiedUrl, setCopiedUrl] = useState('');
	const [inviteOpen, setInviteOpen] = useState(false);
	const [previousInvite, setPreviousInvite] = useState(actionData);
	const invite =
		inviteOpen &&
		actionData !== previousInvite &&
		actionData &&
		!('message' in actionData) &&
		!('deletedId' in actionData) &&
		!('updatedId' in actionData)
			? actionData
			: undefined;
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
	function openInvite(id = '', role = 'user') {
		if (navigation.state !== 'idle') return;
		setTarget(null);
		accountAction.reset();
		setPreviousInvite(actionData);
		setCopiedUrl('');
		setReplacementId(id);
		setInviteRole(role);
		setInviteOpen(true);
	}
	function replacementButton(row: AccountRow, role: 'user' | 'admin') {
		return (
			row.pendingInvite && (
				<button
					type="button"
					className="ui-button ui-button-quiet ui-button-small"
					onClick={() => openInvite(row.publicId, role)}
				>
					Replace invitation
				</button>
			)
		);
	}
	return (
		<section className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-(--toolbar-gap)">
				<h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">
					Users
				</h1>
				<button
					type="button"
					className="ui-button ui-button-primary"
					aria-disabled={navigation.state !== 'idle'}
					onClick={() => openInvite()}
				>
					Invite
				</button>
			</div>
			<Form
				method="get"
				className="mb-4 flex flex-wrap items-end gap-(--toolbar-gap)"
				key={JSON.stringify(page.filters)}
			>
				<label className="grid gap-1">
					Search accounts
					<input
						name="q"
						type="search"
						maxLength={254}
						defaultValue={page.filters.q}
						placeholder="Email, username, or account ID"
						className="ui-field"
					/>
				</label>
				<label className="grid gap-1">
					Status
					<select name="status" defaultValue={page.filters.status} className="ui-field">
						<option value="all">All</option>
						<option value="active">Active</option>
						<option value="banned">Banned</option>
						<option value="pending">Pending invitations</option>
					</select>
				</label>
				<button className="ui-button">Search</button>
			</Form>
			<div className="mb-6">
				<AccountTable
					title="Regular users"
					rows={page.users}
					empty="No users match."
					actions={(row) => (
						<>
							{replacementButton(row, 'user')}
							{!row.pendingInvite && (row.canBan || row.canUnban) && (
								<button
									type="button"
									className="ui-button ui-button-quiet ui-button-small"
									onClick={() =>
										selectAccountAction(
											row.publicId,
											row.username,
											row.canUnban ? 'unban-user' : 'ban-user'
										)
									}
								>
									{row.canUnban ? 'Unban' : 'Ban'}
								</button>
							)}
							<button
								type="button"
								className="ui-button ui-button-quiet ui-button-small text-danger"
								onClick={() => selectAccountAction(row.publicId, row.username, 'delete-user')}
							>
								Delete user
							</button>
						</>
					)}
				/>
				{deletedId && <p role="status">User deleted.</p>}
				{updated && <p role="status">{updated.statusMessage}</p>}
				<Pagination pagination={page.pagination} />
			</div>
			<AccountTable
				title="Admins"
				rows={page.admins.map((admin) => ({
					...admin,
					role: 'Admin',
					statusLabel: admin.pendingInvite
						? 'Pending invitation'
						: admin.emailVerified
							? 'Verified'
							: 'Unverified'
				}))}
				empty="No admins match."
				actions={(row) => replacementButton(row, 'admin')}
			/>
			<Modal
				open={inviteOpen}
				title={replacementId ? 'Replace invitation' : 'Invite someone'}
				onClose={() => setInviteOpen(false)}
			>
				{inviteOpen && (
					<>
						<Form method="post" className="grid gap-3">
							{replacementId ? (
								<>
									<input type="hidden" name="replacementId" value={replacementId} />
									<input type="hidden" name="role" value={inviteRole} />
									<p>Creating a replacement makes the previous invitation link invalid.</p>
								</>
							) : (
								<>
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
								</>
							)}
							<div className="flex flex-wrap gap-2">
								<button
									name="delivery"
									value="email"
									className="ui-button ui-button-primary"
									disabled={navigation.state !== 'idle'}
								>
									{replacementId ? 'Send replacement email' : 'Send email invite'}
								</button>
								<button
									name="delivery"
									value="link"
									className="ui-button"
									disabled={inviteRole === 'admin' || navigation.state !== 'idle'}
								>
									{replacementId
										? 'Create and copy replacement link'
										: 'Create and copy invite link'}
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
			<ConfirmationDialog
				open={Boolean(target) && target?.id !== completedId}
				title={
					deleting
						? `Delete ${target?.name ?? 'this user'}’s account?`
						: `${banning ? 'Ban' : 'Unban'} ${target?.name ?? 'this user'}?`
				}
				description={
					deleting
						? 'This revokes sign-in and removes the account from the user list. Stored data and uploads are retained.'
						: banning
							? 'This blocks sign-in and authenticated access until you unban the user.'
							: 'This restores sign-in and authenticated access for this user.'
				}
				requiredText={deleting ? DELETE_CONFIRMATION : undefined}
				confirmLabel={actionLabel}
				pending={pending}
				error={
					accountAction.data && 'message' in accountAction.data
						? accountAction.data.message
						: undefined
				}
				onConfirm={async (confirmation) => {
					if (target)
						await accountAction.submit(
							{ intent: target.intent, id: target.id, confirmation },
							{ method: 'post' }
						);
				}}
				onDismiss={() => {
					if (!pending) setTarget(null);
				}}
				onClosed={() => {
					if (target && target.id === completedId) {
						setTarget((current) => (current?.id === completedId ? null : current));
						heading.current?.focus();
					}
				}}
			/>
		</section>
	);
}

type AccountRow = {
	publicId: string;
	username: string;
	email: string | null;
	role: string;
	statusLabel: string;
	pendingInvite: boolean;
	canBan?: boolean;
	canUnban?: boolean;
};

function AccountTable({
	title,
	rows,
	empty,
	actions
}: {
	title: string;
	rows: AccountRow[];
	actions?: (row: AccountRow) => ReactNode;
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
						{actions && <th scope="col">Actions</th>}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.publicId}>
							<td>{row.username}</td>
							<td>{row.email}</td>
							<td>{row.role}</td>
							<td>{row.statusLabel}</td>
							{actions && <td>{actions(row)}</td>}
						</tr>
					))}
					{rows.length === 0 && (
						<tr>
							<td colSpan={actions ? 5 : 4} className="text-center text-ink/60">
								{empty}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
