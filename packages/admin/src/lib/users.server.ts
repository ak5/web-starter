import { DELETE_CONFIRMATION } from '@ak5/webui';
import { data, redirect } from 'react-router';
import { apiLoadJson, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';
function accountStatus(value: string | null) {
	return value === 'active' || value === 'banned' || value === 'pending' ? value : 'all';
}
export async function loadUsers(event: ApiRequestEvent) {
	const url = new URL(event.request.url);
	const response = await api(event).admin.users.$get({
		query: {
			page: url.searchParams.get('page') ?? '0',
			q: url.searchParams.get('q') ?? undefined,
			status: accountStatus(url.searchParams.get('status'))
		}
	});
	const data = await apiLoadJson(response, 'Could not load users. Please retry.');
	if (!('pagination' in data)) throw new Response('Invalid users response', { status: 502 });
	if (data.pagination.page >= data.pagination.totalPages) {
		url.searchParams.set('page', String(data.pagination.totalPages - 1));
		throw redirect('/' + url.search);
	}
	return data;
}

export async function createInvite(event: ApiRequestEvent, form: FormData) {
	const delivery = form.get('delivery');
	const role = form.get('role') ?? 'user';
	if (role !== 'user' && role !== 'admin') return { error: 'Choose a valid account role.' };
	if (role === 'admin' && delivery === 'link')
		return { error: 'Admin invitations must be sent by email.' };
	if (delivery !== 'link' && delivery !== 'email')
		return { error: 'Choose how to deliver the invitation.' };
	const replacementId = form.get('replacementId');
	const response =
		typeof replacementId === 'string' && replacementId
			? await api(event).admin.invite[':publicId'].replace.$post({
					param: { publicId: replacementId },
					json: { delivery }
				})
			: await api(event).admin.invite.$post({
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
				? replacementId
					? 'This account no longer has a pending invitation.'
					: 'That email address or username is already in use.'
				: response.status === 503
					? 'The invitation email could not be sent. The invitation is pending and can be replaced again.'
					: 'Could not create the invitation. Check the email and username.';
		return { error: message };
	}
	const body = await response.json();
	return {
		inviteUrl: 'inviteUrl' in body && typeof body.inviteUrl === 'string' ? body.inviteUrl : null
	};
}

export async function deleteUser(event: ApiRequestEvent, form: FormData) {
	const headers = { 'Cache-Control': 'no-store' };
	if (form.get('confirmation') !== DELETE_CONFIRMATION)
		return data({ message: 'Type DELETE to confirm.' }, { status: 400, headers });
	const publicId = form.get('id');
	if (typeof publicId !== 'string' || !publicId)
		return data({ message: 'Missing user id.' }, { status: 400, headers });
	const response = await api(event).admin.users[':publicId'].$delete({ param: { publicId } });
	if (!response.ok)
		return data({ message: 'Could not delete the user.' }, { status: response.status, headers });
	return data({ deletedId: publicId }, { headers });
}
