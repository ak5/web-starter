import { eq } from 'drizzle-orm';
import { LEGAL_VERSIONS } from '@ak5/shared';
import { type Database } from '../db';
import { users } from '../db/schema';

type LegalAcceptanceDb = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export { LEGAL_VERSIONS };

export async function recordBaseLegalAcceptance(
	db: LegalAcceptanceDb,
	userId: string,
	acceptedAt = new Date()
) {
	await db
		.update(users)
		.set({
			termsAcceptedAt: acceptedAt,
			termsVersion: LEGAL_VERSIONS.terms,
			privacyVersion: LEGAL_VERSIONS.privacy,
			acceptableUseVersion: LEGAL_VERSIONS.acceptableUse
		})
		.where(eq(users.id, userId));
}
