import type { Route } from './+types/forgot-password';
import RecoveryForm from '@ak5/webui/components/RecoveryForm';
import { recoveryActions } from '../lib/account.server';
export const action = recoveryActions.default;
export default function Recovery({ actionData }: Route.ComponentProps) {
	return <RecoveryForm form={actionData} />;
}
