import type { Route } from './+types/item-attachment';
import { loadItemAttachment, uploadItemAttachment } from '../lib/items.server';

export function loader(event: Route.LoaderArgs) {
	return loadItemAttachment(event, event.params.id);
}

export function action(event: Route.ActionArgs) {
	if (event.request.method !== 'POST')
		return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
	return uploadItemAttachment(event, event.params.id);
}
