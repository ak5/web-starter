import type { Route } from './+types/password';
import { data as actionData } from 'react-router';
import { requestState } from '@ak5/webui/server';
import PasswordForm from '@ak5/webui/components/PasswordForm';
import { loadPassword, passwordActions } from '../lib/account.server';
export function loader(event: Route.LoaderArgs) {
	return {
		...loadPassword(event),
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
				form={form}
				resetToken={data.resetToken}
				hasPassword={data.hasPassword}
				reauth={data.reauth}
			/>
		</>
	);
}
