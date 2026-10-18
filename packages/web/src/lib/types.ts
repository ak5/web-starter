export type Viewer = {
	publicId: string;
	username: string;
	displayName: string | null;
	avatar: string | null;
	email: string;
	emailVerified: boolean;
	role: 'user' | 'admin';
};
