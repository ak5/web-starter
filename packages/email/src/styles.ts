import { styleToString } from '@better-svelte-email/components/utils';

export const body = styleToString({ fontFamily: 'sans-serif', color: '#1f2937' });
export const container = styleToString({
	margin: '24px auto',
	maxWidth: '448px',
	borderRadius: '8px',
	border: '2px solid #4b5563',
	padding: '24px',
	boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
});
export const logo = styleToString({ margin: '0 auto 24px', display: 'block' });
export const heading = styleToString({
	margin: '20px 0',
	textAlign: 'center',
	fontFamily: 'sans-serif',
	fontSize: '24px',
	color: '#1f2937'
});
export const text = styleToString({ marginBottom: '16px', textAlign: 'center' });
const button = {
	borderRadius: '6px',
	backgroundColor: '#2563eb',
	textAlign: 'center',
	fontWeight: 'bold',
	color: 'white',
	textDecoration: 'none',
	maxWidth: '100%'
};
export const fullButton = styleToString({
	...button,
	width: '100%',
	boxSizing: 'border-box',
	display: 'block'
});
export const compactButton = styleToString({ ...button, width: 'auto', display: 'inline-block' });
export const footnote = styleToString({
	marginTop: '16px',
	textAlign: 'center',
	fontSize: '14px',
	color: '#4b5563'
});
export const footer = styleToString({
	marginTop: '16px',
	textAlign: 'center',
	fontSize: '14px',
	color: '#6b7280'
});
