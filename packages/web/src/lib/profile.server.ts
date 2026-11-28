import { data } from 'react-router';
import {
	apiCookieStaticRedirectAction,
	apiErrorBody,
	accountSecurityAction,
	apiJsonAction,
	apiLoadJson,
	formString,
	requestState,
	type ApiRequestEvent
} from '@ak5/webui/server';
import { DELETE_CONFIRMATION } from '@ak5/webui';
import { api } from './api.server';

export async function loadProfile(event: ApiRequestEvent) {
	const client = api(event);
	const [profile, security] = await Promise.all([
		apiLoadJson(await client.me.$get(), 'Could not load your account.'),
		apiLoadJson(await client.me.security.$get(), 'Could not load your security settings.')
	]);
	if (!('type' in profile) || profile.type !== 'user' || !('emailStatusLabel' in security))
		throw new Response('Account unavailable', { status: 502 });
	return {
		account: profile,
		security,
		impersonated: Boolean(requestState(event.context).session.auth?.impersonatedBy)
	};
}

export async function updateProfile(event: ApiRequestEvent) {
	const { session, cookies } = requestState(event.context);
	if (session.auth?.impersonatedBy)
		return data(
			{ error: 'Account changes are unavailable while impersonating a user.' },
			{ status: 403 }
		);
	const form = await event.request.formData();
	const client = api(event);
	switch (form.get('intent')) {
		case 'request-email-change':
			return accountSecurityAction(
				await client.auth['request-email-change'].$post({
					json: { newEmail: formString(form, 'newEmail') }
				}),
				cookies,
				{ message: 'Check the new address for your code.' }
			);
		case 'confirm-email-change':
			return accountSecurityAction(
				await client.auth['confirm-email-change'].$post({
					json: { code: formString(form, 'code') }
				}),
				cookies,
				{ message: 'Email updated.' }
			);
		case 'reauth-security':
			return accountSecurityAction(await client.auth['request-reauth'].$post(), cookies, {
				message: 'Check your email to continue.'
			});
		case 'logout-all':
			return accountSecurityAction(
				await client.auth['logout-all'].$post({ json: { confirm: true } }),
				cookies,
				{
					redirectTo: '/login'
				}
			);
		case 'profile':
			return apiJsonAction<{ successMessage: string }>(
				await client.me.profile.$patch({
					json: {
						displayName: formString(form, 'displayName'),
						username: formString(form, 'username')
					}
				}),
				'Could not update your profile.'
			);
		case 'avatar': {
			const imageUpload = form.get('imageUpload');
			if (!(imageUpload instanceof File) || !imageUpload.size)
				return data({ error: 'Select an image to upload.' }, { status: 400 });
			const result = await apiJsonAction<{ url: string }>(
				await client.me.avatar.$post({ form: { imageUpload } }),
				'Could not upload your avatar.'
			);
			return 'url' in result ? { successMessage: 'Avatar updated.' } : result;
		}
		case 'delete': {
			if (form.get('confirmation') !== DELETE_CONFIRMATION)
				return data({ error: 'Type DELETE to confirm.' }, { status: 400 });
			const response = await client.me.$delete();
			if (!response.ok) {
				const error = await apiErrorBody(response);
				if (error?.error === 'recent_auth_required')
					return data(
						{ error: 'Sign in again before deleting your account.', reauth: true },
						{ status: 403 }
					);
			}
			return apiCookieStaticRedirectAction(
				response,
				cookies,
				'/',
				'Could not delete your account.'
			);
		}
		default:
			return data({ error: 'Unknown account action.' }, { status: 400 });
	}
}
