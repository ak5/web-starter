import { DELETE_CONFIRMATION } from '@ak5/webui';
import ConfirmationDialog from '@ak5/webui/components/ConfirmationDialog';
import { useEffect, useRef, useState } from 'react';
import type { Route } from './+types/items';
import { Form, data as actionData, useFetcher } from 'react-router';
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
	const heading = useRef<HTMLHeadingElement>(null);
	const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
	const deletion = useFetcher<typeof action>();
	const pending = deletion.state !== 'idle';
	const deleted = !pending && deletion.data && 'deleted' in deletion.data && deletion.data.deleted;
	function selectDeletion(id: string, name: string) {
		deletion.reset();
		setTarget({ id, name });
	}
	const createForm = useRef<HTMLFormElement>(null);
	useEffect(() => {
		if (form && 'created' in form && form.created) createForm.current?.reset();
	}, [form]);
	const message = form && 'message' in form ? form.message : undefined;
	return (
		<section className="mx-auto max-w-3xl p-8">
			<h1 ref={heading} tabIndex={-1} className="mb-2 text-3xl font-bold">
				Your items
			</h1>
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
				actions={(item, title) => (
					<button
						type="button"
						className="ui-button ui-button-quiet ui-button-small text-danger"
						onClick={() => selectDeletion(item.id, title ?? 'this item')}
					>
						Delete
					</button>
				)}
			/>
			{deleted && <p role="status">Item deleted.</p>}
			<Pagination pagination={data.pagination} />
			<ConfirmationDialog
				open={Boolean(target) && !deleted}
				title={`Delete ${target?.name ?? 'this item'}?`}
				description="This permanently removes the item."
				requiredText={DELETE_CONFIRMATION}
				confirmLabel="Delete permanently"
				pending={pending}
				error={deletion.data && 'message' in deletion.data ? deletion.data.message : undefined}
				onConfirm={async (confirmation) => {
					if (target)
						await deletion.submit(
							{ intent: 'delete', id: target.id, confirmation },
							{ method: 'post' }
						);
				}}
				onDismiss={() => {
					if (!pending) setTarget(null);
				}}
				onClosed={() => {
					if (deleted) {
						setTarget(null);
						heading.current?.focus();
					}
				}}
			/>
		</section>
	);
}
