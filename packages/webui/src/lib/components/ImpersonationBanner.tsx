export default function ImpersonationBanner({
	returnAction = '/admin-return'
}: {
	returnAction?: string;
}) {
	return (
		<>
			<div className="bg-caution py-1 text-center text-sm text-on-caution">
				Impersonating user -
				<form action={returnAction} method="post" className="inline">
					<button type="submit" className="font-semibold underline">
						Return to Admin
					</button>
				</form>
			</div>
		</>
	);
}
