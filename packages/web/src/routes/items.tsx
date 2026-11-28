import { useEffect, useRef } from 'react';
import type { Route } from './+types/items';
import { Form, data as actionData } from 'react-router';
import ItemsTable from '@ak5/webui/components/ItemsTable';
import Pagination from '@ak5/webui/components/Pagination';
import { itemsActions, loadItems } from '../lib/items.server';
export const loader = loadItems;
export async function action(event: Route.ActionArgs) {
	const form = await event.request.formData();
	const intent = form.get('intent');
	if (intent === 'create' || intent === 'delete') return itemsActions[intent](event, form);
	return actionData({ message: 'Unknown action.' }, { status: 400 });
}
export default function Items({ loaderData: data, actionData: form }: Route.ComponentProps) {
	const createForm = useRef<HTMLFormElement>(null);
	useEffect(() => {
		if (form && 'created' in form && form.created) createForm.current?.reset();
	}, [form]);
	const message = form && 'message' in form ? form.message : undefined;
	return (
		<section className="mx-auto max-w-3xl p-8">
			<h1 className="mb-2 text-3xl font-bold">Your items</h1>
			<p className="mb-6 text-ink/70">
				An example CRUD resource, rendered with the shared <code>ItemsTable</code> component — the
				same one the admin app uses to list all items.
			</p>

			<Form ref={createForm} method="post" className="mb-4 flex gap-2">
				<input
					name="title"
					placeholder="New item title"
					className="ui-field flex-1"
					aria-label="New item title"
				/>
				<button className="ui-button ui-button-primary" type="submit" name="intent" value="create">
					Add item
				</button>
			</Form>

			{message && <p className="mb-4 text-sm text-danger">{message}</p>}

			<ItemsTable
				items={data.items}
				actions={(item) => (
					<Form method="post">
						<input type="hidden" name="id" value={item.id} />
						<button
							className="ui-button ui-button-quiet ui-button-small text-danger"
							type="submit"
							name="intent"
							value="delete"
						>
							Delete
						</button>
					</Form>
				)}
			/>
			<Pagination pagination={data.pagination} />
		</section>
	);
}
