import { Form } from 'react-router';
export default function ReauthConfirmation() {
	return (
		<>
			<title>Confirm your identity</title>
			<div className="ui-panel mx-auto my-8 max-w-md bg-surface p-6">
				<h1 className="mb-4 text-2xl font-bold">Confirm your identity</h1>
				<p className="mb-4">Continue to confirm this session before updating your password.</p>
				<Form method="post">
					<button type="submit" className="ui-button ui-button-primary">
						Confirm and continue
					</button>
				</Form>
			</div>
		</>
	);
}
