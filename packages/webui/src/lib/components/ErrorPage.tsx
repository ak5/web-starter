import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export default function ErrorPage() {
	const error = useRouteError();
	const response = isRouteErrorResponse(error) ? error : undefined;
	return (
		<section className="hero min-h-[60vh]">
			<div className="hero-content text-center">
				<div>
					<h1 className="text-4xl font-bold">{response?.status ?? 500}</h1>
					<p className="py-4 text-base-content/70">
						{typeof response?.data === 'string'
							? response.data
							: response?.statusText || 'Something went wrong.'}
					</p>
					<Link to="/" className="btn">
						Back home
					</Link>
				</div>
			</div>
		</section>
	);
}
