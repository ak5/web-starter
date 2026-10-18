import { env as workerEnv } from 'cloudflare:workers';
import {
	handleSyncRequest,
	makeDurableObject,
	matchSyncRequest,
	type CfTypes
} from '@livestore/sync-cf/cf-worker';
import { authorizeSync, validateNoteEvents } from './lib/sync-auth';
import type { Env } from './types';

export class NotesSync extends makeDurableObject({
	storage: { _tag: 'd1', binding: 'DB' },
	enabledTransports: new Set(['http']),
	forwardHeaders: ['cookie'],
	onPush: async (message, context) => {
		if (
			!context.headers ||
			!(await authorizeSync(workerEnv as unknown as Env, context.headers, context.storeId))
		)
			throw new Error('Sync access denied');
		validateNoteEvents(message.batch);
	},
	onPull: async (_message, context) => {
		if (
			!context.headers ||
			!(await authorizeSync(workerEnv as unknown as Env, context.headers, context.storeId))
		)
			throw new Error('Sync access denied');
	}
}) {}

export async function syncRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	if (request.method !== 'POST')
		return Response.json({ error: 'method_not_allowed' }, { status: 405 });
	// LiveStore pins Workers types independently from Wrangler’s generated runtime.
	const cfRequest = request as unknown as CfTypes.Request;
	const params = matchSyncRequest(cfRequest);
	if (!params || params.transport !== 'http' || params.payload != null)
		return Response.json({ error: 'invalid_sync_request' }, { status: 400 });
	if (!(await authorizeSync(env, request.headers, params.storeId)))
		return Response.json({ error: 'unauthorized' }, { status: 401 });
	return handleSyncRequest<{ NOTES_SYNC: CfTypes.DurableObjectNamespace }>({
		request: cfRequest,
		env: { NOTES_SYNC: env.NOTES_SYNC as unknown as CfTypes.DurableObjectNamespace },
		ctx: ctx as unknown as CfTypes.ExecutionContext,
		searchParams: params,
		syncBackendBinding: 'NOTES_SYNC'
	}) as unknown as Promise<Response>;
}
