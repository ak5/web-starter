<script lang="ts">
	import { onMount } from 'svelte';
	import type { ISymbioteEvent } from '@symbiote-native/engine';
	import { FlatList } from '@symbiote-native/svelte';
	import type { ItemDto } from '@ak5/api';
	import { ApiError, InputError, createClient, parseItemData } from './src/client';
	import { sessionStorage } from './src/storage';
	import { Linking } from 'react-native';
	import { apiUrl, webUrl } from './src/config';

	const client = createClient(apiUrl, sessionStorage);
	type User = NonNullable<Awaited<ReturnType<typeof client.restore>>>;
	let user = $state<User | null>(null);
	let ready = $state(false);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let registering = $state(false);
	let accepted = $state(false);
	let email = $state('');
	let username = $state('');
	let password = $state('');
	let pin = $state('');
	let items = $state<ItemDto[]>([]);
	let page = $state(0);
	let hasNext = $state(false);
	let selected = $state<ItemDto | null>(null);
	let editing = $state(false);
	let data = $state('{}');
	let deleting = $state(false);

	function resetSession() {
		user = null;
		items = [];
		selected = null;
		editing = false;
		deleting = false;
		data = '{}';
		page = 0;
		hasNext = false;
		password = '';
		pin = '';
		accepted = false;
		registering = false;
	}

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		error = '';
		notice = '';
		try {
			await action();
		} catch (cause) {
			if (cause instanceof ApiError && cause.status === 401) {
				resetSession();
			}
			error =
				cause instanceof ApiError && cause.message === 'email_delivery_failed'
					? 'Email could not be sent. Use Resend code to retry.'
					: cause instanceof ApiError || cause instanceof InputError
						? cause.message
						: 'Something went wrong. Please retry.';
		} finally {
			busy = false;
		}
	}

	async function load(target = 0) {
		const result = await client.list(target);
		if ('items' in result) {
			items = result.items;
			page = target;
			hasNext = result.pagination.hasNext;
		}
	}

	async function authenticate() {
		await run(async () => {
			if (registering) {
				const result = await client.register(email.trim(), password, username.trim(), accepted);
				user = result.user;
				if (!result.result.verificationEmailSent)
					notice = 'Account created. Email could not be sent. Use Resend code to retry.';
			} else user = await client.login(email.trim(), password);
			password = '';
			if (user?.emailConfirmed) await load();
		});
	}

	onMount(() => {
		void run(async () => {
			user = await client.restore();
			if (user?.emailConfirmed) await load();
		}).finally(() => {
			ready = true;
		});
	});
</script>

{#snippet button(label: string, action: () => void, disabled = false)}
	<pressable
		accessibilityRole="button"
		accessibilityLabel={label}
		disabled={busy || disabled}
		onPress={action}
		class="button"
	>
		<text class="button-text">{label}</text>
	</pressable>
{/snippet}

{#snippet itemRow({ item }: { item: ItemDto })}
	<pressable
		accessibilityRole="button"
		accessibilityLabel={`Open ${item.id}`}
		class="row"
		onPress={() => {
			selected = item;
			deleting = false;
		}}
	>
		<text class="heading">{item.id}</text>
		<text class="body" numberOfLines={2}>{JSON.stringify(item.data)}</text>
	</pressable>
{/snippet}

<safe-area-view class="safe">
	<view class="screen">
		<text class="title">ak5 mobile</text>
		{#if busy}<text class="body" accessibilityLiveRegion="polite">Working…</text>{/if}
		{#if error}<text class="error" accessibilityRole="alert">{error}</text>{/if}
		{#if notice}<text class="body" accessibilityLiveRegion="polite">{notice}</text>{/if}
		{#if !ready}
			<text class="body">Restoring your session…</text>
		{:else if !user}
			<scroll-view contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
				<text class="heading">{registering ? 'Create account' : 'Sign in'}</text>
				<text-input
					class="input"
					accessibilityLabel="Email"
					placeholder="Email"
					autoCapitalize="none"
					keyboardType="email-address"
					value={email}
					onChangeText={(event) => {
						email = String(event.nativeEvent.text ?? '');
					}}
				/>
				{#if registering}<text-input
						class="input"
						accessibilityLabel="Username"
						placeholder="Username"
						autoCapitalize="none"
						value={username}
						onChangeText={(event) => {
							username = String(event.nativeEvent.text ?? '');
						}}
					/>{/if}
				<text-input
					class="input"
					accessibilityLabel="Password"
					placeholder="Password"
					secureTextEntry
					value={password}
					onChangeText={(event) => {
						password = String(event.nativeEvent.text ?? '');
					}}
				/>
				{#if registering}
					<text class="body">Review and accept the policies before creating your account.</text>
					{@render button(
						'Terms of service',
						() =>
							void run(async () => {
								await Linking.openURL(`${webUrl}/terms-of-service`);
							})
					)}
					{@render button(
						'Privacy policy',
						() =>
							void run(async () => {
								await Linking.openURL(`${webUrl}/privacy`);
							})
					)}
					{@render button(
						'Acceptable use policy',
						() =>
							void run(async () => {
								await Linking.openURL(`${webUrl}/acceptable-use`);
							})
					)}
					<switch
						accessibilityLabel="Accept Terms, Privacy and Acceptable Use policies"
						value={accepted}
						onValueChange={(event: ISymbioteEvent) => {
							accepted = Boolean(event.nativeEvent.value);
						}}
					/>
				{/if}
				{@render button(
					registering ? 'Create account' : 'Sign in',
					() => void authenticate(),
					registering && !accepted
				)}
				{@render button(registering ? 'Have an account? Sign in' : 'Create an account', () => {
					registering = !registering;
					error = '';
				})}
				{@render button(
					'Recover password',
					() =>
						void run(async () => {
							await client.recover(email.trim());
							notice =
								'If an account exists, recovery instructions will arrive by email. Open the link in the web app.';
						})
				)}
			</scroll-view>
		{:else if !user.emailConfirmed}
			<text class="heading">Verify your email</text>
			<text class="body">Enter the code from your email. If it did not arrive, resend it.</text>
			<text-input
				class="input"
				accessibilityLabel="Verification code"
				keyboardType="number-pad"
				value={pin}
				onChangeText={(event) => {
					pin = String(event.nativeEvent.text ?? '');
				}}
			/>
			{@render button(
				'Verify code',
				() =>
					void run(async () => {
						user = await client.verify(pin);
						await load();
					})
			)}
			{@render button(
				'Resend code',
				() =>
					void run(async () => {
						await client.resend();
						notice = 'Code sent. Check your inbox.';
					})
			)}
		{:else if editing}
			<text class="heading">{selected ? 'Edit item' : 'Create item'}</text>
			<text-input
				class="editor input"
				accessibilityLabel="Item JSON object"
				multiline
				value={data}
				onChangeText={(event) => {
					data = String(event.nativeEvent.text ?? '');
				}}
			/>
			{@render button(
				'Save',
				() =>
					void run(async () => {
						const parsed = parseItemData(data);
						if (selected) await client.update(selected.id, parsed);
						else await client.create(parsed);
						editing = false;
						selected = null;
						await load();
					})
			)}
			{@render button('Cancel', () => {
				editing = false;
			})}
		{:else if selected}
			<text class="heading">{selected.id}</text>
			<scroll-view><text class="body">{JSON.stringify(selected.data, null, 2)}</text></scroll-view>
			{@render button('Edit', () => {
				data = JSON.stringify(selected?.data, null, 2);
				editing = true;
			})}
			{#if deleting}
				<text class="error">Delete this item permanently?</text>
				{@render button(
					'Confirm delete',
					() =>
						void run(async () => {
							if (selected) await client.remove(selected.id);
							selected = null;
							deleting = false;
							await load();
						})
				)}
				{@render button('Keep item', () => {
					deleting = false;
				})}
			{:else}{@render button('Delete', () => {
					deleting = true;
				})}{/if}
			{@render button('Back to items', () => {
				selected = null;
			})}
		{:else}
			<text class="heading">Items · page {page + 1}</text>
			{@render button('Create item', () => {
				selected = null;
				data = '{}';
				editing = true;
			})}
			<FlatList
				data={items}
				item={itemRow}
				keyExtractor={(item) => item.id}
				initialNumToRender={8}
				maxToRenderPerBatch={8}
				windowSize={5}
				style={{ flex: 1 }}
			/>
			{#if items.length === 0}<text class="body">No items yet.</text>{/if}
			<view class="pager">
				{@render button('Previous page', () => void run(() => load(page - 1)), page === 0)}
				{@render button('Next page', () => void run(() => load(page + 1)), !hasNext)}
			</view>
			{@render button('Refresh', () => void run(() => load(page)))}
		{/if}
		{#if user}{@render button(
				'Sign out',
				() =>
					void run(async () => {
						await client.logout();
						resetSession();
						email = '';
						username = '';
					})
			)}{/if}
	</view>
</safe-area-view>

<style>
	.safe {
		flex: 1;
		background-color: #f8fafc;
	}
	.screen {
		flex: 1;
		padding: 24px;
		gap: 12px;
		background-color: #f8fafc;
	}
	.title {
		font-size: 28px;
		font-weight: bold;
		color: #0f172a;
	}
	.heading {
		font-size: 18px;
		font-weight: bold;
		color: #0f172a;
	}
	.body {
		color: #334155;
		font-size: 16px;
	}
	.error {
		color: #b91c1c;
		font-size: 16px;
	}
	.input {
		background-color: #ffffff;
		color: #0f172a;
		padding: 12px;
		border-width: 1px;
		border-color: #64748b;
		border-radius: 8px;
	}
	.editor {
		min-height: 160px;
	}
	.button {
		background-color: #1d4ed8;
		padding: 12px;
		border-radius: 8px;
		align-items: center;
	}
	.button-text {
		color: #ffffff;
		font-size: 16px;
	}
	.row {
		padding: 16px;
		gap: 8px;
		background-color: #ffffff;
		margin-bottom: 8px;
	}
	.pager {
		flex-direction: row;
		gap: 8px;
	}
</style>
