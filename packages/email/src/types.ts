export interface VerifyEmailProps {
	pin: string;
	appUrl?: string;
}

export interface ResetPasswordProps {
	token: string;
	appUrl?: string;
}

export interface LoginWithProps {
	identities: [string, string][];
	appUrl?: string;
}

export interface InviteAccountProps {
	inviteUrl: string;
	role?: 'user' | 'admin';
	appUrl?: string;
}
