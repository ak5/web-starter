import './app.css';
import { Form, Link, Outlet } from 'react-router';
import { createAuthMiddleware } from '@ak5/webui/server';
import Document from '@ak5/webui/components/Document';
import EnvironmentBanner from '@ak5/webui/components/EnvironmentBanner';
import ErrorPage from '@ak5/webui/components/ErrorPage';
import Navbar from '@ak5/webui/components/Navbar';
import { loadAppShell } from './lib/app-shell.server';
import type { Route } from './+types/root';

export const Layout = Document;
export const ErrorBoundary = ErrorPage;
export const middleware = [
	createAuthMiddleware({
		allowedJwtType: 'admin',
		isProtectedPath: (path) =>
			!['/login', '/forgot-password', '/account/password', '/invite'].includes(path),
		isAuthPage: (path) => path === '/login',
		loggedInHome: '/'
	})
];

export const loader = loadAppShell;
// Keep the shell and guarded navigations in sync with session revocation.
export const shouldRevalidate = () => true;

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<div
			className="flex min-h-screen flex-col"
			data-density={loaderData.viewer ? 'compact' : 'comfortable'}
		>
			<EnvironmentBanner environment={loaderData.environmentBanner} />
			<Navbar
				brand="ak5-web admin"
				actions={
					<>
						{loaderData.viewer && (
							<>
								<Link to="/" className="ui-button ui-button-quiet ui-button-small">
									Users
								</Link>
								<Link to="/items" className="ui-button ui-button-quiet ui-button-small">
									Items
								</Link>
								<Link to="/account/password" className="ui-button ui-button-quiet ui-button-small">
									Password
								</Link>
								<Form method="post" action="/logout" reloadDocument>
									<button type="submit" className="ui-button ui-button-quiet ui-button-small">
										Sign out
									</button>
								</Form>
							</>
						)}
					</>
				}
			/>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
