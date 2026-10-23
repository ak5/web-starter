import { z } from 'zod';

import { usernameSchema } from './auth-form';
import { optionalBlankNullableString } from './request-parsing';

export const profilePatchSchema = z.object({
	displayName: optionalBlankNullableString(z.string().min(1).max(128)),
	avatar: optionalBlankNullableString(z.string().url().max(512)),
	username: usernameSchema.optional()
});
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const avatarUploadSchema = z.object({
	imageUpload: z.custom<File>((value) => value instanceof File, 'image_required')
});
