import { Link, useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '../root';

export default function Home() {
	const data = useRouteLoaderData<typeof rootLoader>('root');
	return (
		<>
			<section className="hero min-h-[70vh]">
				<div className="hero-content text-center">
					<div className="max-w-md">
						<h1 className="text-5xl font-bold">ak5-web</h1>
						<p className="py-6 text-base-content/70">
							A batteries-included full-stack starter — Hono API, split React Router apps,
							Cloudflare D1, auth. Replace this landing page with your product.
						</p>
						{data?.viewer ? (
							<>
								<Link to="/dashboard" className="btn btn-primary">
									Go to your dashboard
								</Link>
							</>
						) : (
							<>
								<div className="flex justify-center gap-3">
									<Link to="/register" className="btn btn-primary">
										Get started
									</Link>
									<Link to="/login" className="btn btn-ghost">
										Sign in
									</Link>
								</div>
							</>
						)}
					</div>
				</div>
			</section>

			<footer className="py-6 text-center text-sm text-base-content/70">
				Made with &lt;3 by{' '}
				<a className="link" href="https://alexander.verver.is">
					ak5
				</a>
			</footer>
		</>
	);
}
