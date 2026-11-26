import type { Route } from './+types/invite';
import { redirect } from 'react-router';
export function loader({ url }: Route.LoaderArgs) {
	return redirect(
		'/account/password?' + new URLSearchParams({ t: url.searchParams.get('t') ?? '' }),
		303
	);
}
