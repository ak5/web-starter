import type { Route } from './+types/register';
import { Form, Link, useSearchParams } from 'react-router';
import { errorMessage } from '@ak5/webui';
import OAuthLogin from '../lib/OAuthLogin';
import { registerAction } from '../lib/register.server';
export const action = registerAction;
export default function Register({ actionData: form }: Route.ComponentProps) {
	const [searchParams] = useSearchParams();
	const oauthError = searchParams.get('error');
	return (
		<div className="card bg-base-200 p-6">
			<h1 className="mb-4 text-2xl font-bold">Create your account</h1>
			{(form?.error || oauthError) && (
				<>
					<div role="alert" className="mb-4 alert alert-error">
						{form?.error ?? errorMessage(oauthError)}
					</div>
				</>
			)}
			<Form method="post" className="flex flex-col gap-3">
				<label htmlFor="username">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					placeholder="Username"
					autoComplete="username"
					className="input-bordered input w-full"
					defaultValue={form?.username ?? ''}
					required
				/>
				<label htmlFor="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					placeholder="Email"
					autoComplete="email"
					className="input-bordered input w-full"
					defaultValue={form?.email ?? ''}
					required
				/>
				<label htmlFor="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					placeholder="Password (min 8 characters)"
					autoComplete="new-password"
					className="input-bordered input w-full"
					required
				/>
				<button className="btn btn-primary" type="submit">
					Create account
				</button>
			</Form>
			<OAuthLogin />
			<p className="mt-4 text-sm text-base-content/70">
				Already have an account?{' '}
				<Link to="/login" className="link">
					Sign in
				</Link>
			</p>
		</div>
	);
}
