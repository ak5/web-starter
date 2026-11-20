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
			<div className="card mx-auto my-8 max-w-md bg-base-200 p-6">
				<h1 className="mb-4 text-2xl font-bold">Reset password</h1>
				<p className="mb-4">Enter your account email and we’ll send you a reset link.</p>
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
				<Form ref={formRef} method="post" className="flex flex-col gap-3">
					<label htmlFor="recovery-email">Email</label>
					<input
						id="recovery-email"
						name="email"
						type="email"
						autoComplete="email"
						className="input-bordered input w-full"
						required
					/>
					<button type="submit" className="btn btn-primary">
						Send reset link
					</button>
				</Form>
				<Link to="/login" className="mt-4 link">
					Back to sign in
				</Link>
			</div>
		</>
	);
}
