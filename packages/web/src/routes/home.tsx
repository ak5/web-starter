import { Link, useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '../root';

export default function Home() {
	const data = useRouteLoaderData<typeof rootLoader>('root');
	return (
		<>
			<section className="grid min-h-[70vh] place-items-center px-4">
				<div className="max-w-full text-center">
					<div className="max-w-md">
						<h1 className="text-5xl font-bold">ak5-web</h1>
						<p className="py-6 text-ink/70">
							A batteries-included full-stack starter — Hono API, split React Router apps,
							Cloudflare D1, auth. Replace this landing page with your product.
						</p>
						{data?.viewer ? (
							<>
								<Link to="/dashboard" className="ui-button ui-button-primary">
									Go to your dashboard
								</Link>
							</>
						) : (
							<>
								<div className="flex justify-center gap-3">
									{data?.registrationOpen && (
										<Link to="/register" className="ui-button ui-button-primary">
											Get started
										</Link>
									)}
									<Link to="/login" className="ui-button ui-button-quiet">
										Sign in
									</Link>
								</div>
							</>
						)}
					</div>
				</div>
			</section>

			<footer className="py-6 text-center text-sm text-ink/70">
				Made with &lt;3 by{' '}
				<a className="ui-link" href="https://alexander.verver.is">
					ak5
				</a>
			</footer>
		</>
	);
}
