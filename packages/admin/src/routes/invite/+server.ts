import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	throw redirect(
		303,
		`/account/password?${new URLSearchParams({ t: url.searchParams.get('t') ?? '' })}`
	);
};
