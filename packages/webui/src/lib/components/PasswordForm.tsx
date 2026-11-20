import { useEffect, useRef } from 'react';
import { Link, Form } from 'react-router';
export default function PasswordForm({
	resetToken = '',
	hasPassword,
	reauth,
	form
}: {
	resetToken?: string;
	hasPassword: boolean;
	reauth?: string | null;
	form?: { error?: string; code?: string; successMessage?: string } | null;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	useEffect(() => {
		if (form?.successMessage) formRef.current?.reset();
	}, [form]);
	const title = resetToken
		? 'Set your new password'
		: hasPassword
			? 'Change password'
			: 'Set a password';
	return (
		<>
			<title>{title}</title>
			<div className="card mx-auto my-8 max-w-md bg-base-200 p-6">
				<h1 className="mb-4 text-2xl font-bold">{title}</h1>
				{form?.error && (
					<>
						<p role="alert" className="mb-4 alert alert-error">
							{form.error}
						</p>
					</>
				)}
				{form?.successMessage && (
					<>
						<p role="status" className="mb-4 alert alert-success">
							{form.successMessage}
						</p>
					</>
				)}
				{reauth === 'ok' ? (
					<>
						<p role="status" className="mb-4 alert alert-success">
							Identity confirmed. You can now update your password.
						</p>
					</>
				) : reauth === 'failed' ? (
					<>
						<p role="alert" className="mb-4 alert alert-error">
							That confirmation link is invalid or expired. Request a new one below.
						</p>
					</>
				) : null}
				<Form ref={formRef} method="post" className="flex flex-col gap-3">
					<input type="hidden" name="token" value={resetToken} />
					{hasPassword && !resetToken && (
						<>
							<label htmlFor="current-password">Current password</label>
							<input
								id="current-password"
								name="currentPassword"
								type="password"
								autoComplete="current-password"
								className="input-bordered input w-full"
								required
							/>
						</>
					)}
					<label htmlFor="new-password">New password</label>
					<input
						id="new-password"
						name="newPassword"
						type="password"
						autoComplete="new-password"
						minLength={8}
						maxLength={128}
						className="input-bordered input w-full"
						required
					/>
					<label htmlFor="confirm-password">Confirm new password</label>
					<input
						id="confirm-password"
						name="password2"
						type="password"
						autoComplete="new-password"
						minLength={8}
						maxLength={128}
						className="input-bordered input w-full"
						required
					/>
					<button type="submit" name="intent" value="save" className="btn btn-primary">
						Save password
					</button>
				</Form>
				{!resetToken && (form?.code === 'recent_auth_required' || reauth === 'failed') && (
					<>
						<Form method="post" className="mt-4">
							<button type="submit" name="intent" value="reauth" className="btn btn-secondary">
								Email a confirmation link
							</button>
						</Form>
					</>
				)}
				<Link to="/forgot-password" className="mt-4 link">
					Request a new reset link
				</Link>
			</div>
		</>
	);
}
