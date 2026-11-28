import { useFetcher } from 'react-router';

export default function EmailChangeForm({ email }: { email: string }) {
	const form = useFetcher<{ error?: string; reauth?: boolean; successMessage?: string }>();
	const busy = form.state !== 'idle';
	return (
		<section className="grid gap-3">
			<h3 className="text-lg font-semibold">Change email</h3>
			<p>Current sign-in email: {email}</p>
			<form.Form method="post" className="flex flex-wrap items-end gap-2">
				<label className="grid gap-1">
					New email
					<input className="ui-field" name="newEmail" type="email" autoComplete="email" required />
				</label>
				<button className="ui-button" name="intent" value="request-email-change" disabled={busy}>
					Send code
				</button>
			</form.Form>
			<form.Form method="post" className="flex flex-wrap items-end gap-2">
				<label className="grid gap-1">
					Email change code
					<input
						className="ui-field"
						name="code"
						autoComplete="one-time-code"
						maxLength={6}
						required
					/>
				</label>
				<button className="ui-button" name="intent" value="confirm-email-change" disabled={busy}>
					Confirm email change
				</button>
			</form.Form>
			{form.data?.error && <p role="alert">{form.data.error}</p>}
			{form.data?.successMessage && <p role="status">{form.data.successMessage}</p>}
			{form.data?.reauth && (
				<form.Form method="post">
					<button className="ui-button" name="intent" value="reauth-security" disabled={busy}>
						Email me a sign-in link
					</button>
				</form.Form>
			)}
		</section>
	);
}
