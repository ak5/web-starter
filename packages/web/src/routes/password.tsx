import type { Route } from './+types/password';
import { data as actionData } from 'react-router';
import { requestState } from '@ak5/webui/server';
import PasswordForm from '@ak5/webui/components/PasswordForm';
import { loadPassword, passwordActions } from '../lib/account.server';
export function loader(event: Route.LoaderArgs) {
	return {
		...loadPassword(event),
		mcpConnected:
			requestState(event.context).env.MCP_ENABLED === 'true' &&
			!!requestState(event.context).session.auth &&
			!requestState(event.context).session.auth?.impersonatedBy,
		mcpDisconnected: event.url.searchParams.get('mcp') === 'disconnected',
		hasPassword: requestState(event.context).session.auth?.hasPassword ?? false
	};
}
export async function action(event: Route.ActionArgs) {
	const intent = (await event.request.clone().formData()).get('intent');
	if (intent === 'save' || intent === 'reauth') return passwordActions[intent](event);
	return actionData({ error: 'Unknown action.' }, { status: 400 });
}
export default function Password({ loaderData: data, actionData: form }: Route.ComponentProps) {
	return (
		<>
			<PasswordForm
				form={form ?? data.connectionError}
				resetToken={data.resetToken}
				hasPassword={data.hasPassword}
				reauth={data.reauth}
			/>

			{data.connection === 'discord' && (
				<>
					<p role="status" className="mx-auto alert max-w-md alert-success">
						Discord login connected.
					</p>
				</>
			)}
			{data.mcpConnected && (
				<form action="/oauth/disconnect" method="post" className="mx-auto mt-4 max-w-md">
					{data.mcpDisconnected && <p role="status">MCP connections disconnected.</p>}
					<button className="btn" type="submit">
						Disconnect MCP clients
					</button>
				</form>
			)}
		</>
	);
}
