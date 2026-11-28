import type { Route } from './+types/register';
import { Form, Link, useSearchParams, useRouteLoaderData } from 'react-router';
import { errorMessage } from '@ak5/webui';
import OAuthLogin from '../lib/OAuthLogin';
import { registerAction } from '../lib/register.server';
import type { loader as rootLoader } from '../root';
export const action = registerAction;
export default function Register({ actionData: form }: Route.ComponentProps) {
	const [searchParams] = useSearchParams();
	const registrationOpen = useRouteLoaderData<typeof rootLoader>('root')?.registrationOpen;
	const oauthError = searchParams.get('error');
	if (!registrationOpen) {
		return (
			<div className="ui-panel bg-surface p-6">
				<h1 className="mb-4 text-2xl font-bold">Invitation required</h1>
				<p className="mb-4">Open your invitation link to create an account.</p>
				<Link to="/login" className="ui-link">
					Sign in
				</Link>
			</div>
		);
	}
	return (
		<div className="ui-panel bg-surface p-6">
			<h1 className="mb-4 text-2xl font-bold">Create your account</h1>
			{(form?.error || oauthError) && (
				<>
					<div role="alert" className="ui-message ui-message-error mb-4">
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
					className="ui-field w-full"
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
					className="ui-field w-full"
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
					className="ui-field w-full"
					required
				/>
				<button className="ui-button ui-button-primary" type="submit">
					Create account
				</button>
			</Form>
			<OAuthLogin />
			<p className="mt-4 text-sm text-ink/70">
				Already have an account?{' '}
				<Link to="/login" className="ui-link">
					Sign in
				</Link>
			</p>
		</div>
	);
}
