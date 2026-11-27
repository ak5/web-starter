import type { Route } from './+types/login';
import { Form, Link } from 'react-router';
import { loginAction } from '../lib/login.server';
export const action = loginAction;
export default function Login({ actionData: form }: Route.ComponentProps) {
	return (
		<div className="ui-panel bg-surface p-6">
			<h1 className="mb-4 text-2xl font-bold">Admin sign in</h1>
			{form?.error && (
				<>
					<div role="alert" className="ui-message ui-message-error mb-4">
						{form.error}
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
		</div>
	);
}
