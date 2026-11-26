import type { WebApiType } from '@ak5/api';
import { apiBaseUrl, createApiClient, requestState, type ApiRequestEvent } from '@ak5/webui/server';

export function api({ context, request }: ApiRequestEvent) {
	const { env, fetch } = requestState(context);
	return createApiClient<WebApiType>(apiBaseUrl(env), fetch, request);
}
