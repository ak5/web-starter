import type { Route } from './+types/login';
import { Form, Link, useSearchParams, useRouteLoaderData } from 'react-router';
import { errorMessage } from '@ak5/webui';
import OAuthLogin from '../lib/OAuthLogin';
import { loginAction } from '../lib/login.server';
import type { loader as rootLoader } from '../root';
export const action = loginAction;
export default function Login({ actionData: form }: Route.ComponentProps) {
	const [searchParams] = useSearchParams();
	const registrationOpen = useRouteLoaderData<typeof rootLoader>('root')?.registrationOpen;
	const oauthError = searchParams.get('error');
	return (
		<div className="ui-panel bg-surface p-6">
			<h1 className="mb-4 text-2xl font-bold">Welcome back</h1>
			{(form?.error || oauthError) && (
				<>
					<div role="alert" className="ui-message ui-message-error mb-4">
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
					className="ui-field w-full"
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
					className="ui-field w-full"
					required
				/>
				<button className="ui-button ui-button-primary" type="submit">
					Sign in
				</button>
			</Form>
			<Link to="/forgot-password" className="ui-link mt-4">
				Forgot password?
			</Link>
			<OAuthLogin />
			{registrationOpen && (
				<p className="mt-4 text-sm text-ink/70">
					No account?{' '}
					<Link to="/register" className="ui-link">
						Create one
					</Link>
				</p>
			)}
		</div>
	);
}
