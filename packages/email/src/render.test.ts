import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'parse5';
import { renderTemplate } from '../dist/index.js';

function content(html: string) {
	const text: string[] = [];
	const links: string[] = [];
	const tags: string[] = [];
	function walk(node: ReturnType<typeof parse>['childNodes'][number]) {
		if (node.nodeName === '#text' && 'value' in node) text.push(node.value);
		if ('tagName' in node) tags.push(node.tagName);
		if ('attrs' in node && node.tagName === 'a') {
			links.push(node.attrs.find((attribute) => attribute.name === 'href')?.value ?? '');
		}
		if ('childNodes' in node) node.childNodes.forEach(walk);
	}
	parse(html).childNodes.forEach(walk);
	return { text: text.join(' ').replace(/\s+/g, ' '), links, tags };
}

test('all four compiled Svelte templates preserve subjects, copy, links and safe HTML', async () => {
	const hostile = '<script>alert("private")</script> & example';
	const appUrl = 'https://example.test';
	const inviteUrl = `${appUrl}/invite?t=invite-token&from=admin`;
	const cases = [
		[
			renderTemplate('VerifyEmail', { pin: hostile, appUrl }),
			'Verify Email',
			hostile,
			`${appUrl}/account/verify`
		],
		[
			renderTemplate('ResetPassword', { token: 'reset-token', appUrl }),
			'Reset Password',
			'Click the button below to reset your password',
			`${appUrl}/account/password?t=reset-token`
		],
		[
			renderTemplate('LoginWith', {
				identities: [['email', hostile]],
				appUrl: `${appUrl}/auth/confirm?t=login-token`
			}),
			'Account Access Attempt',
			hostile,
			`${appUrl}/auth/confirm?t=login-token`
		],
		[
			renderTemplate('InviteAccount', { inviteUrl, role: 'admin', appUrl }),
			'You are invited',
			'An administrator created a admin account for you.',
			inviteUrl
		]
	] as const;
	for (const [pending, subject, copy, link] of cases) {
		const rendered = await pending;
		const document = content(rendered.html);
		assert.equal(rendered.subject, subject);
		assert.ok(document.text.includes(copy));
		assert.deepEqual(document.links, [link]);
		assert.ok(!document.tags.includes('script'));
		assert.match(rendered.html, /lang="en"/);
		assert.match(rendered.html, /<!DOCTYPE html PUBLIC/);
		assert.match(rendered.html, /<!--\[if mso\]>/);
		assert.doesNotMatch(rendered.html, /<!--(?:\[\??|\]|)-->/);
		assert.doesNotMatch(rendered.html, /\\u[0-9a-f]{4}/i);
	}
});

test('verification PIN and magic links remain readable by the actual mock extractors', async () => {
	const { html: verify } = await renderTemplate('VerifyEmail', { pin: 'T3ST42' });
	assert.equal(
		verify.match(/font-family:\s*monospace[^>]*>\s*([A-Za-z0-9]{4,8})\s*</)?.[1],
		'T3ST42'
	);
	assert.ok(content(verify).text.includes('The code is valid for one hour.'));
	const url = 'https://example.test/invite?t=private-token';
	const { html: invite } = await renderTemplate('InviteAccount', { inviteUrl: url });
	assert.equal(invite.match(/href="(https?:\/\/[^"]+\?t=[^"]+)"/)?.[1], url);
	assert.ok(content(invite).text.includes('An administrator created a ak5-web account for you.'));
	assert.ok(content(invite).text.includes('This link expires in 7 days.'));
});
