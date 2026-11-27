import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export default function ErrorPage() {
	const error = useRouteError();
	const response = isRouteErrorResponse(error) ? error : undefined;
	return (
		<section className="grid min-h-[60vh] place-items-center px-4">
			<div className="max-w-full text-center">
				<div>
					<h1 className="text-4xl font-bold">{response?.status ?? 500}</h1>
					<p className="py-4 text-ink/70">
						{typeof response?.data === 'string'
							? response.data
							: response?.statusText || 'Something went wrong.'}
					</p>
					<Link to="/" className="ui-button">
						Back home
					</Link>
				</div>
			</div>
		</section>
	);
}
