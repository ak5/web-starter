import type { CSSProperties } from 'react';

export const body: CSSProperties = { fontFamily: 'sans-serif', color: '#1f2937' };
export const container: CSSProperties = {
	margin: '24px auto',
	maxWidth: '448px',
	borderRadius: '8px',
	border: '2px solid #4b5563',
	padding: '24px',
	boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
};
export const logo: CSSProperties = {
	margin: '0 auto 24px',
	display: 'block',
	outline: 'none',
	border: 'none',
	textDecoration: 'none'
};
export const heading: CSSProperties = {
	margin: '20px 0',
	textAlign: 'center',
	fontFamily: 'sans-serif',
	fontSize: '24px',
	color: '#1f2937'
};
export const text: CSSProperties = {
	fontSize: '14px',
	lineHeight: '24px',
	margin: '16px 0',
	textAlign: 'center'
};
export const footnote: CSSProperties = { ...text, color: '#4b5563' };
export const footer: CSSProperties = { ...text, color: '#6b7280' };
