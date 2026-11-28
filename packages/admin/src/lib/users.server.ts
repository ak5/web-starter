import { redirect } from 'react-router';
import { apiLoadJson, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';
export async function loadUsers(event: ApiRequestEvent) {
	const url = new URL(event.request.url);
	const response = await api(event).admin.users.$get({
		query: { page: url.searchParams.get('page') ?? '0' }
	});
	const data = await apiLoadJson(response, 'Could not load users. Please retry.');
	if (data.pagination.page >= data.pagination.totalPages) {
		url.searchParams.set('page', String(data.pagination.totalPages - 1));
		throw redirect(url.pathname + url.search);
	}
	return data;
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
