import { renderDocument } from '@ak5/webui/server';
import type { EntryContext, RouterContextProvider } from 'react-router';

export default function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	routerContext: EntryContext,
	context: RouterContextProvider
) {
	return renderDocument(request, status, headers, routerContext, context, true);
}
