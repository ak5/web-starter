import './app.css';
import { Form, Link, Outlet } from 'react-router';
import { createAuthMiddleware, matchesPathPrefix } from '@ak5/webui/server';
import Document from '@ak5/webui/components/Document';
import EnvironmentBanner from '@ak5/webui/components/EnvironmentBanner';
import ErrorPage from '@ak5/webui/components/ErrorPage';
import Footer from '@ak5/webui/components/Footer';
import Navbar from '@ak5/webui/components/Navbar';
import { loadAppShell } from './lib/app-shell.server';
import type { Route } from './+types/root';

export const Layout = Document;
export const ErrorBoundary = ErrorPage;
export const middleware = [
	createAuthMiddleware({
		allowedJwtType: 'user',
		isProtectedPath: (path) =>
			path !== '/account/password' &&
			matchesPathPrefix(path, [
				'/dashboard',
				'/account',
				'/notes',
				'/items',
				'/sync',
				'/auth/magic'
			]),
		isAuthPage: (path) => path === '/login' || path === '/register',
		loggedInHome: '/dashboard'
	})
];

export const loader = loadAppShell;
// Keep the shell and guarded navigations in sync with session revocation.
export const shouldRevalidate = () => true;

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex min-h-screen flex-col">
			<EnvironmentBanner environment={loaderData.environmentBanner} />
			<Navbar
				brand="ak5-web"
				actions={
					<>
						{loaderData.viewer ? (
							<>
								<Link to="/dashboard" className="ui-button ui-button-quiet ui-button-small">
									Dashboard
								</Link>
								<Link to="/notes" className="ui-button ui-button-quiet ui-button-small">
									Offline notes
								</Link>
								<Link to="/items" className="ui-button ui-button-quiet ui-button-small">
									Items
								</Link>
								<Link to="/account" className="ui-button ui-button-quiet ui-button-small">
									Account
								</Link>
								<Form method="post" action="/logout" reloadDocument>
									<button type="submit" className="ui-button ui-button-quiet ui-button-small">
										Sign out
									</button>
								</Form>
							</>
						) : (
							<>
								<Link to="/login" className="ui-button ui-button-quiet ui-button-small">
									Sign in
								</Link>
								{loaderData.registrationOpen && (
									<Link to="/register" className="ui-button ui-button-primary ui-button-small">
										Get started
									</Link>
								)}
							</>
						)}
					</>
				}
			/>
			<main className="flex-1">
				<Outlet />
			</main>
			<Footer />
		</div>
	);
}
