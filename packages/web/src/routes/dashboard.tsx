import { Link, useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '../root';
export const loader = () => null;
export default function Dashboard() {
	const data = useRouteLoaderData<typeof rootLoader>('root');
	return (
		<>
			<section className="mx-auto max-w-2xl p-8">
				<h1 className="text-3xl font-bold">You're signed in 🎉</h1>
				<p className="py-4 text-ink/70">
					This is a protected route. Replace it with your application.
				</p>
				<div className="ui-panel flex flex-col gap-1 bg-surface p-4">
					<p>
						<span className="font-semibold">User:</span> {data?.viewer?.username}
					</p>
					<p>
						<span className="font-semibold">Email:</span> {data?.viewer?.email}
					</p>
					<p>
						<span className="font-semibold">Email verified:</span>
						{data?.viewer?.emailVerified ? 'yes' : 'no'}
					</p>
				</div>
				{!data?.viewer?.emailVerified && (
					<>
						<Link to="/account/verify" className="ui-link mt-4 inline-block">
							Verify your email or request a new code
						</Link>
					</>
				)}
				<p className="mt-6 text-sm text-ink/60">Sign out from the top bar.</p>
			</section>
		</>
	);
}
