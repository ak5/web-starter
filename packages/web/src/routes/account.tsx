import { useState } from 'react';
import { Form, Link, useFetcher, useNavigation } from 'react-router';
import { DELETE_CONFIRMATION } from '@ak5/webui';
import LogoutAll from '@ak5/webui/components/LogoutAll';
import EmailChangeForm from '@ak5/webui/components/EmailChangeForm';
import ConfirmationDialog from '@ak5/webui/components/ConfirmationDialog';
import { loadProfile, updateProfile } from '../lib/profile.server';
import type { Route } from './+types/account';

export const loader = loadProfile;
export const action = updateProfile;
export const headers = () => ({ 'Cache-Control': 'no-store' });

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
	const { account, security, impersonated } = loaderData;
	const [confirming, setConfirming] = useState(false);
	const deletion = useFetcher<typeof action>();
	const needsReauth = deletion.data && 'reauth' in deletion.data && deletion.data.reauth;
	const busy = useNavigation().state !== 'idle';
	return (
		<section className="mx-auto grid max-w-2xl gap-6 p-6">
			<h1 className="text-3xl font-semibold">Account</h1>
			{actionData && 'error' in actionData && <p role="alert">{actionData.error}</p>}
			{actionData && 'successMessage' in actionData && (
				<p role="status">{actionData.successMessage}</p>
			)}
			<section className="ui-panel grid gap-4 p-5">
				<h2 className="text-xl font-semibold">Profile</h2>
				<Form
					method="post"
					className="grid gap-3"
					key={JSON.stringify([account.username, account.displayName])}
				>
					<fieldset disabled={busy || impersonated} className="grid gap-3">
						<label className="grid gap-1">
							Display name
							<input
								name="displayName"
								defaultValue={account.displayName ?? ''}
								maxLength={128}
								className="ui-field"
							/>
						</label>
						<label className="grid gap-1">
							Username
							<input
								name="username"
								defaultValue={account.username}
								required
								pattern="[A-Za-z0-9_]{5,20}"
								className="ui-field"
							/>
						</label>
						<button name="intent" value="profile" className="ui-button w-fit">
							Save profile
						</button>
					</fieldset>
				</Form>
				{account.avatar && (
					<img src={account.avatar} alt="" width={64} height={64} className="rounded-full" />
				)}
				<Form method="post" encType="multipart/form-data" className="grid gap-3">
					<fieldset disabled={busy || impersonated} className="grid gap-3">
						<label className="grid gap-1">
							Avatar image
							<input type="file" name="imageUpload" accept="image/webp,.webp" required />
						</label>
						<button name="intent" value="avatar" className="ui-button w-fit">
							Upload avatar
						</button>
					</fieldset>
				</Form>
			</section>
			<section className="ui-panel grid gap-3 p-5">
				<h2 className="text-xl font-semibold">Security</h2>
				<p>
					{security.email} · {security.emailStatusLabel}
				</p>
				{!security.emailVerified && (
					<Link to="/account/verify" className="ui-link">
						Verify email
					</Link>
				)}
				<Link to="/account/password" className="ui-link">
					Password settings
				</Link>
				{security.hasEmailAuth && !impersonated && <EmailChangeForm email={security.email} />}
				{!impersonated && <LogoutAll />}
			</section>
			{!impersonated && (
				<section className="ui-panel grid gap-3 p-5">
					<h2 className="text-xl font-semibold">Delete account</h2>
					<p>Deleting your account revokes sign-in. Stored data and uploads are retained.</p>
					{needsReauth ? (
						<Link to="/account/password?reauth=failed" className="ui-link">
							Confirm your sign-in
						</Link>
					) : (
						<button
							type="button"
							className="ui-button w-fit text-danger"
							onClick={() => {
								deletion.reset();
								setConfirming(true);
							}}
						>
							Delete account
						</button>
					)}
					<ConfirmationDialog
						open={confirming && !needsReauth}
						title="Delete your account?"
						description="This revokes sign-in and cannot be undone from the app. Stored data and uploads are retained."
						confirmLabel="Delete account"
						requiredText={DELETE_CONFIRMATION}
						pending={deletion.state !== 'idle'}
						error={deletion.data && 'error' in deletion.data ? deletion.data.error : undefined}
						onConfirm={async (confirmation) => {
							await deletion.submit({ intent: 'delete', confirmation }, { method: 'post' });
						}}
						onDismiss={() => setConfirming(false)}
					/>
				</section>
			)}
		</section>
	);
}
