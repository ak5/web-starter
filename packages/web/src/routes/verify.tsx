import type { Route } from './+types/verify';
import { Form, data as actionData } from 'react-router';
import { loadVerification, verificationActions } from '../lib/verify-email.server';
export const loader = loadVerification;
export async function action(event: Route.ActionArgs) {
	const form = await event.request.formData();
	const intent = form.get('intent');
	if (intent === 'verify') return verificationActions.verify(event, form);
	if (intent === 'resend') return verificationActions.resend(event);
	return actionData({ error: 'Unknown action.' }, { status: 400 });
}
export default function Verify({ loaderData: data, actionData: form }: Route.ComponentProps) {
	return (
		<div className="card mx-auto max-w-md bg-base-200 p-6">
			<h1 className="mb-4 text-2xl font-bold">Verify your email</h1>
			<p className="mb-4">Enter the code from your email. You can request a new code below.</p>
			{form?.error ? (
				<>
					<p role="alert" className="mb-4 alert alert-error">
						{form.error}
					</p>
				</>
			) : data.deliverySent ? (
				<>
					<p role="status" className="mb-4 alert alert-success">
						A new code has been sent.
					</p>
				</>
			) : data.deliveryFailed ? (
				<>
					<p role="alert" className="mb-4 alert alert-error">
						Your account is ready, but we could not send the verification email. Please try
						resending later.
					</p>
				</>
			) : null}
			<Form method="post" className="flex flex-col gap-3">
				<label htmlFor="pin">Verification code</label>
				<input
					id="pin"
					name="pin"
					autoComplete="one-time-code"
					className="input-bordered input"
					required
				/>
				<button type="submit" name="intent" value="verify" className="btn btn-primary">
					Verify email
				</button>
			</Form>
			<Form method="post" className="mt-4">
				<button type="submit" name="intent" value="resend" className="btn btn-secondary">
					Resend verification email
				</button>
			</Form>
		</div>
	);
}
