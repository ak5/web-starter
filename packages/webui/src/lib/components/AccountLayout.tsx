import { Outlet } from 'react-router';

export default function AccountLayout() {
	return (
		<div className="flex min-h-[80vh] items-center justify-center p-4">
			<div className="w-full max-w-md">
				<Outlet />
			</div>
		</div>
	);
}
