/**
 * Password hashing wrapper around `worker-password-auth`. Centralized so the
 * algorithm choice (argon2id) and salt format live in one place.
 */
import { hashPassword as rawHash, verifyPassword as rawVerify } from 'worker-password-auth';

export async function hashPassword(plain: string): Promise<string> {
	return rawHash(plain);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
	return rawVerify(plain, hashed);
}
