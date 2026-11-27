import type { Route } from './+types/items';
import ItemsTable from '@ak5/webui/components/ItemsTable';
import { loadAdminItems } from '../lib/items.server';
export const loader = loadAdminItems;
export default function Items({ loaderData: data }: Route.ComponentProps) {
	return (
		<section className="mx-auto max-w-4xl p-8">
			<h1 className="mb-2 text-3xl font-bold">All items</h1>
			<p className="mb-6 text-ink/70">
				Every user's items (read-only oversight), rendered with the shared <code>ItemsTable</code> —
				the same component the web app uses for a single user's items.
			</p>
			<ItemsTable items={data.items} showOwner />
		</section>
	);
}
