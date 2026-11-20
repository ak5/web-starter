import { useCallback, useEffect, useRef, useState } from 'react';
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ItemDto } from '@ak5/api';
import { ApiError, InputError, createClient, parseItemData, type SessionUser } from './src/client';
import { apiUrl } from './src/config';
import { LocalNotes } from './src/LocalNotes';
import { sessionStorage } from './src/storage';
import { ActionButton, placeholderColor, styles } from './src/ui';

const client = createClient(apiUrl, sessionStorage);

export default function App() {
	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.safe}>
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					style={styles.fill}
				>
					<MobileApp />
				</KeyboardAvoidingView>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

function MobileApp() {
	const [user, setUser] = useState<SessionUser | null>(null);
	const [ready, setReady] = useState(false);
	const [showNotes, setShowNotes] = useState(true);
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [registering, setRegistering] = useState(false);
	const [email, setEmail] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [pin, setPin] = useState('');
	const [items, setItems] = useState<ItemDto[]>([]);
	const [page, setPage] = useState(0);
	const [hasNext, setHasNext] = useState(false);
	const [selected, setSelected] = useState<ItemDto | null>(null);
	const [editing, setEditing] = useState(false);
	const [data, setData] = useState('{}');
	const [deleting, setDeleting] = useState(false);

	const resetSession = useCallback(() => {
		setUser(null);
		setItems([]);
		setSelected(null);
		setEditing(false);
		setDeleting(false);
		setData('{}');
		setPage(0);
		setHasNext(false);
		setPassword('');
		setPin('');
		setRegistering(false);
	}, []);

	const run = useCallback(
		async (action: () => Promise<void>) => {
			if (running.current) return;
			running.current = true;
			setBusy(true);
			setError('');
			setNotice('');
			try {
				await action();
			} catch (cause) {
				if (cause instanceof ApiError && cause.status === 401) resetSession();
				setError(
					cause instanceof ApiError && cause.message === 'email_delivery_failed'
						? 'Email could not be sent. Use Resend code to retry.'
						: cause instanceof ApiError || cause instanceof InputError
							? cause.message
							: 'Something went wrong. Please retry.'
				);
			} finally {
				running.current = false;
				setBusy(false);
			}
		},
		[resetSession]
	);

	useEffect(() => {
		void run(async () => {
			try {
				setUser(await client.restore());
			} finally {
				setReady(true);
			}
		});
	}, [run]);

	async function load(target = 0) {
		const result = await client.list(target);
		if ('items' in result) {
			setItems(result.items);
			setPage(target);
			setHasNext(result.pagination.hasNext);
		}
	}

	function authenticate() {
		void run(async () => {
			if (registering) {
				const result = await client.register(email.trim(), password, username.trim());
				setUser(result.user);
				if (!result.result.verificationEmailSent)
					setNotice('Account created. Email could not be sent. Use Resend code to retry.');
			} else {
				setUser(await client.login(email.trim(), password));
			}
			setPassword('');
			setShowNotes(true);
		});
	}

	function button(label: string, onPress: () => void, disabled = false) {
		return <ActionButton label={label} onPress={onPress} disabled={busy || disabled} />;
	}

	function screen() {
		if (!ready) return <Text style={styles.body}>Restoring your session…</Text>;
		if (!user) {
			return (
				<ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
					<Text style={styles.heading}>{registering ? 'Create account' : 'Sign in'}</Text>
					<TextInput
						style={styles.input}
						accessibilityLabel="Email"
						placeholder="Email"
						placeholderTextColor={placeholderColor}
						autoCapitalize="none"
						keyboardType="email-address"
						value={email}
						onChangeText={setEmail}
					/>
					{registering && (
						<TextInput
							style={styles.input}
							accessibilityLabel="Username"
							placeholder="Username"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							value={username}
							onChangeText={setUsername}
						/>
					)}
					<TextInput
						style={styles.input}
						accessibilityLabel="Password"
						placeholder="Password"
						placeholderTextColor={placeholderColor}
						secureTextEntry
						value={password}
						onChangeText={setPassword}
					/>
					{button(registering ? 'Create account' : 'Sign in', authenticate)}
					{button(registering ? 'Have an account? Sign in' : 'Create an account', () => {
						setRegistering(!registering);
						setError('');
					})}
					{button(
						'Recover password',
						() =>
							void run(async () => {
								await client.recover(email.trim());
								setNotice(
									'If an account exists, recovery instructions will arrive by email. Open the link in the web app.'
								);
							})
					)}
				</ScrollView>
			);
		}
		if (showNotes) {
			return <LocalNotes key={user.sub} publicId={user.sub} cookie={client.sessionCookie()} />;
		}
		if (!user.emailConfirmed) {
			return (
				<ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
					<Text style={styles.heading}>Verify your email</Text>
					<Text style={styles.body}>
						Enter the code from your email. If it did not arrive, resend it.
					</Text>
					<TextInput
						style={styles.input}
						accessibilityLabel="Verification code"
						autoCapitalize="characters"
						autoCorrect={false}
						maxLength={6}
						value={pin}
						onChangeText={setPin}
					/>
					{button(
						'Verify code',
						() =>
							void run(async () => {
								setUser(await client.verify(pin));
								await load();
							})
					)}
					{button(
						'Resend code',
						() =>
							void run(async () => {
								await client.resend();
								setNotice('Code sent. Check your inbox.');
							})
					)}
				</ScrollView>
			);
		}
		if (editing) {
			return (
				<ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
					<Text style={styles.heading}>{selected ? 'Edit item' : 'Create item'}</Text>
					<TextInput
						style={[styles.input, styles.editor]}
						accessibilityLabel="Item JSON object"
						multiline
						value={data}
						onChangeText={setData}
					/>
					{button(
						'Save',
						() =>
							void run(async () => {
								const parsed = parseItemData(data);
								if (selected) await client.update(selected.id, parsed);
								else await client.create(parsed);
								setEditing(false);
								setSelected(null);
								await load();
							})
					)}
					{button('Cancel', () => setEditing(false))}
				</ScrollView>
			);
		}
		if (selected) {
			return (
				<>
					<Text style={styles.heading}>{selected.id}</Text>
					<ScrollView>
						<Text style={styles.body}>{JSON.stringify(selected.data, null, 2)}</Text>
					</ScrollView>
					{button('Edit', () => {
						setData(JSON.stringify(selected.data, null, 2));
						setEditing(true);
					})}
					{deleting ? (
						<>
							<Text style={styles.error}>Delete this item permanently?</Text>
							{button(
								'Confirm delete',
								() =>
									void run(async () => {
										await client.remove(selected.id);
										setSelected(null);
										setDeleting(false);
										await load();
									})
							)}
							{button('Keep item', () => setDeleting(false))}
						</>
					) : (
						button('Delete', () => setDeleting(true))
					)}
					{button('Back to items', () => setSelected(null))}
				</>
			);
		}
		return (
			<>
				<Text style={styles.heading}>Items · page {page + 1}</Text>
				{button('Create item', () => {
					setSelected(null);
					setData('{}');
					setEditing(true);
				})}
				<FlatList
					data={items}
					style={styles.fill}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Open ${item.id}`}
							style={styles.row}
							onPress={() => {
								setSelected(item);
								setDeleting(false);
							}}
						>
							<Text style={styles.heading}>{item.id}</Text>
							<Text style={styles.body} numberOfLines={2}>
								{JSON.stringify(item.data)}
							</Text>
						</Pressable>
					)}
					initialNumToRender={8}
					maxToRenderPerBatch={8}
					windowSize={5}
					ListEmptyComponent={<Text style={styles.body}>No items yet.</Text>}
				/>
				<View style={styles.pager}>
					{button('Previous page', () => void run(() => load(page - 1)), page === 0)}
					{button('Next page', () => void run(() => load(page + 1)), !hasNext)}
				</View>
				{button('Refresh', () => void run(() => load(page)))}
			</>
		);
	}

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>ak5 mobile</Text>
			{busy && (
				<Text style={styles.body} accessibilityLiveRegion="polite">
					Working…
				</Text>
			)}
			{error !== '' && (
				<Text style={styles.error} accessibilityRole="alert">
					{error}
				</Text>
			)}
			{notice !== '' && (
				<Text style={styles.body} accessibilityLiveRegion="polite">
					{notice}
				</Text>
			)}
			{screen()}
			{user && (
				<>
					{button(showNotes ? 'Online items / verify email' : 'Offline notes', () => {
						setShowNotes(!showNotes);
						if (showNotes && user.emailConfirmed) void run(() => load());
					})}
					{button(
						'Sign out',
						() =>
							void run(async () => {
								await client.logout();
								resetSession();
								setEmail('');
								setUsername('');
							})
					)}
				</>
			)}
		</View>
	);
}
