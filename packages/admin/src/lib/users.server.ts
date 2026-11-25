import { apiLoadJson, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';
export async function loadUsers(event: ApiRequestEvent) {
	const response = await api(event).admin.users.$get();
	const data = await apiLoadJson(response, 'Could not load users. Please retry.');
	return { users: data.users };
}

export async function createInvite(event: ApiRequestEvent) {
	const form = await event.request.formData();
	const delivery = form.get('delivery');
	const role = form.get('role') ?? 'user';
	if (role !== 'user' && role !== 'admin') return { error: 'Choose a valid account role.' };
	if (role === 'admin' && delivery === 'link')
		return { error: 'Admin invitations must be sent by email.' };
	if (delivery !== 'link' && delivery !== 'email')
		return { error: 'Choose how to deliver the invitation.' };
	const response = await api(event).admin.invite.$post({
		json: {
			username: String(form.get('username') ?? ''),
			email: String(form.get('email') ?? ''),
			role,
			delivery
		}
	});
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		if (
			body &&
			typeof body === 'object' &&
			'error' in body &&
			body.error === 'invite_email_unavailable'
		)
			return {
				error:
					role === 'admin'
						? 'Email delivery is unavailable. Configure email delivery to invite an admin.'
						: 'Email delivery is unavailable. Use Create and copy invite link instead.'
			};
		const message =
			response.status === 409
				? 'That email address or username is already in use.'
				: response.status === 503
					? 'The account was created, but the invitation email could not be sent.'
					: 'Could not create the invitation. Check the email and username.';
		return { error: message };
	}
	const body = await response.json();
	return {
		inviteUrl: 'inviteUrl' in body && typeof body.inviteUrl === 'string' ? body.inviteUrl : null
	};
}
