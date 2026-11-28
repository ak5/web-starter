import type { Route } from './+types/password';
import { data as actionData } from 'react-router';
import { accountSecurityAction, formString, requestState } from '@ak5/webui/server';
import LogoutAll from '@ak5/webui/components/LogoutAll';
import EmailChangeForm from '@ak5/webui/components/EmailChangeForm';
import { api } from '../lib/api.server';
import PasswordForm from '@ak5/webui/components/PasswordForm';
import { loadPassword, passwordActions } from '../lib/account.server';
export function loader(event: Route.LoaderArgs) {
	const auth = requestState(event.context).session.auth;
	return {
		showSessionControls: Boolean(auth && !auth.impersonatedBy),
		securityEmail: auth?.hasPassword && !auth.impersonatedBy ? auth.email : null,
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
	const fields = await event.request.clone().formData();
	const intent = fields.get('intent');
	if (intent === 'save' || intent === 'reauth') return passwordActions[intent](event);
	const client = api(event);
	const { cookies } = requestState(event.context);
	if (intent === 'request-email-change')
		return accountSecurityAction(
			await client.auth['request-email-change'].$post({
				json: { newEmail: formString(fields, 'newEmail') }
			}),
			cookies,
			{ message: 'Check the new address for your code.' }
		);
	if (intent === 'confirm-email-change')
		return accountSecurityAction(
			await client.auth['confirm-email-change'].$post({
				json: { code: formString(fields, 'code') }
			}),
			cookies,
			{ message: 'Email updated.' }
		);
	if (intent === 'reauth-security')
		return accountSecurityAction(await client.auth['request-reauth'].$post(), cookies, {
			message: 'Check your email to continue.'
		});
	if (intent === 'logout-all')
		return accountSecurityAction(
			await client.auth['logout-all'].$post({ json: { confirm: true } }),
			cookies,
			{
				redirectTo: '/login'
			}
		);
	return actionData({ error: 'Unknown action.' }, { status: 400 });
}
export default function Password({ loaderData: data, actionData: form }: Route.ComponentProps) {
	return (
		<>
			<PasswordForm
				form={form}
				resetToken={data.resetToken}
				hasPassword={data.hasPassword}
				reauth={data.reauth}
			/>
			{data.securityEmail && !data.resetToken && (
				<div className="mx-auto mt-4 max-w-md">
					<EmailChangeForm email={data.securityEmail} />
				</div>
			)}
			{data.showSessionControls && !data.resetToken && (
				<div className="mx-auto mt-4 max-w-md">
					<LogoutAll />
				</div>
			)}
			{data.mcpConnected && (
				<form action="/oauth/disconnect" method="post" className="mx-auto mt-4 max-w-md">
					{data.mcpDisconnected && <p role="status">MCP connections disconnected.</p>}
					<button className="ui-button" type="submit">
						Disconnect MCP clients
					</button>
				</form>
			)}
		</>
	);
}
