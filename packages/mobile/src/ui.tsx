import { Pressable, StyleSheet, Text } from 'react-native';

export function ActionButton({
	label,
	onPress,
	disabled = false
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={[styles.button, disabled && styles.disabled]}
		>
			<Text style={styles.buttonText}>{label}</Text>
		</Pressable>
	);
}

export const placeholderColor = '#64748b';

export const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: '#f8fafc' },
	screen: { flex: 1, padding: 24, gap: 12 },
	fill: { flex: 1 },
	form: { gap: 16 },
	notes: { gap: 12 },
	title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
	heading: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
	body: { color: '#334155', fontSize: 16 },
	error: { color: '#b91c1c', fontSize: 16 },
	input: {
		backgroundColor: '#ffffff',
		color: '#0f172a',
		padding: 12,
		borderWidth: 1,
		borderColor: '#64748b',
		borderRadius: 8
	},
	editor: { minHeight: 160, textAlignVertical: 'top' },
	button: {
		backgroundColor: '#1d4ed8',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center'
	},
	buttonText: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
	disabled: { opacity: 0.55 },
	row: { padding: 16, gap: 8, backgroundColor: '#ffffff', marginBottom: 8 },
	pager: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	link: { fontSize: 16, color: '#1d4ed8', padding: 8 }
});
