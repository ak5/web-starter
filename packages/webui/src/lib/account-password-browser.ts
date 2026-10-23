export function accountPasswordMismatchMessage(newPassword: string, passwordConfirm: string) {
	return newPassword === passwordConfirm ? '' : 'Passwords do not match';
}

export function accountPasswordMatchState(password: string, passwordConfirm: string) {
	return password === passwordConfirm && passwordConfirm.length > 0;
}
