import { useState } from 'react';
import { useFetcher } from 'react-router';
import ConfirmationDialog from './ConfirmationDialog.js';

export default function LogoutAll() {
	const [open, setOpen] = useState(false);
	const form = useFetcher<{ error?: string; reauth?: boolean; successMessage?: string }>();
	const busy = form.state !== 'idle';
	const reauth = form.data?.reauth;
	return (
		<section className="grid gap-2">
			<button
				type="button"
				className="ui-button w-fit"
				onClick={() => {
					form.reset();
					setOpen(true);
				}}
			>
				Sign out everywhere
			</button>
			{reauth && (
				<form.Form method="post">
					<p role="alert">{form.data?.error}</p>
					<button className="ui-button" name="intent" value="reauth-security" disabled={busy}>
						Email me a sign-in link
					</button>
				</form.Form>
			)}
			{form.data?.successMessage && <p role="status">{form.data.successMessage}</p>}
			{!open && !reauth && form.data?.error && <p role="alert">{form.data.error}</p>}
			<ConfirmationDialog
				open={open && !reauth}
				title="Sign out everywhere?"
				description="This signs out this browser and revokes access on other devices the next time they connect."
				confirmLabel="Sign out everywhere"
				pending={busy}
				error={form.data?.error}
				onConfirm={async () => {
					await form.submit({ intent: 'logout-all' }, { method: 'post' });
					setOpen(false);
				}}
				onDismiss={() => setOpen(false)}
			/>
		</section>
	);
}
