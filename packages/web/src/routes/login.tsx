import type { Route } from './+types/login';
import { Form, Link, useSearchParams } from 'react-router';
import { errorMessage } from '@ak5/webui';
import OAuthLogin from '../lib/OAuthLogin';
import { loginAction } from '../lib/login.server';
export const action = loginAction;
export default function Login({ actionData: form }: Route.ComponentProps) {
	const [searchParams] = useSearchParams();
	const oauthError = searchParams.get('error');
	return (
		<div className="card bg-base-200 p-6">
			<h1 className="mb-4 text-2xl font-bold">Welcome back</h1>
			{(form?.error || oauthError) && (
				<>
					<div role="alert" className="mb-4 alert alert-error">
						{form?.error ?? errorMessage(oauthError)}
					</div>
				</>
			)}
			<Form method="post" className="flex flex-col gap-3">
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
					placeholder="Password"
					autoComplete="current-password"
					className="input-bordered input w-full"
					required
				/>
				<button className="btn btn-primary" type="submit">
					Sign in
				</button>
			</Form>
			<Link to="/forgot-password" className="mt-4 link">
				Forgot password?
			</Link>
			<OAuthLogin />
			<p className="mt-4 text-sm text-base-content/70">
				No account?{' '}
				<Link to="/register" className="link">
					Create one
				</Link>
			</p>
		</div>
	);
}
