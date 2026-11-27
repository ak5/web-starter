import { useEffect, useRef } from 'react';
import { Link, Form } from 'react-router';
export default function RecoveryForm({
	form
}: {
	form?: { error?: string; successMessage?: string } | null;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	useEffect(() => {
		if (form?.successMessage) formRef.current?.reset();
	}, [form]);
	return (
		<>
			<title>Reset password</title>
			<div className="ui-panel mx-auto my-8 max-w-md bg-surface p-6">
				<h1 className="mb-4 text-2xl font-bold">Reset password</h1>
				<p className="mb-4">Enter your account email and we’ll send you a reset link.</p>
				{form?.error && (
					<>
						<p role="alert" className="ui-message ui-message-error mb-4">
							{form.error}
						</p>
					</>
				)}
				{form?.successMessage && (
					<>
						<p role="status" className="ui-message ui-message-success mb-4">
							{form.successMessage}
						</p>
					</>
				)}
				<Form ref={formRef} method="post" className="flex flex-col gap-3">
					<label htmlFor="recovery-email">Email</label>
					<input
						id="recovery-email"
						name="email"
						type="email"
						autoComplete="email"
						className="ui-field w-full"
						required
					/>
					<button type="submit" className="ui-button ui-button-primary">
						Send reset link
					</button>
				</Form>
				<Link to="/login" className="ui-link mt-4">
					Back to sign in
				</Link>
			</div>
		</>
	);
}
