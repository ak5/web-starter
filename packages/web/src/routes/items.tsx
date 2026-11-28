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
	if (intent === 'create') return itemsActions.create(event, form);
	if (intent === 'delete' || intent === 'delete-attachment')
		return itemsActions.delete(event, form);
	return actionData({ message: 'Unknown action.' }, { status: 400 });
}
export default function Items({ loaderData: data, actionData: form }: Route.ComponentProps) {
	const heading = useRef<HTMLHeadingElement>(null);
	const [target, setTarget] = useState<{
		id: string;
		name: string;
		attachment: boolean;
		hasAttachment: boolean;
	} | null>(null);
	const deletion = useFetcher<typeof action>();
	const pending = deletion.state !== 'idle';
	const deletedId =
		!pending && deletion.data && 'deletedId' in deletion.data ? deletion.data.deletedId : undefined;
	function selectDeletion(id: string, name: string, attachment: boolean, hasAttachment = false) {
		deletion.reset();
		setTarget({ id, name, attachment, hasAttachment });
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
					<>
						{data.attachmentsEnabled &&
							(item.attachment ? (
								<div className="flex flex-wrap items-center justify-end gap-2">
									<a className="ui-link" href={`/items/${item.id}/attachment`} download>
										Download {item.attachment.name}
									</a>
									<button
										type="button"
										className="ui-button ui-button-small"
										onClick={() =>
											selectDeletion(item.id, item.attachment?.name ?? 'this attachment', true)
										}
									>
										Delete attachment
									</button>
								</div>
							) : (
								<AttachmentUpload id={item.id} />
							))}
						<button
							type="button"
							className="ui-button ui-button-quiet ui-button-small text-danger"
							onClick={() =>
								selectDeletion(item.id, title ?? 'this item', false, Boolean(item.attachment))
							}
						>
							Delete
						</button>
					</>
				)}
			/>
			{deletedId && (
				<p role="status">
					{deletion.data && 'attachment' in deletion.data && deletion.data.attachment
						? 'Attachment deleted.'
						: 'Item deleted.'}
				</p>
			)}
			<Pagination pagination={data.pagination} />
			<ConfirmationDialog
				open={Boolean(target) && target?.id !== deletedId}
				title={`Delete ${target?.name ?? 'this item'}?`}
				description={
					target?.attachment
						? 'This removes the attachment from the item.'
						: target?.hasAttachment
							? 'This permanently removes the item and its attachment.'
							: 'This permanently removes the item.'
				}
				requiredText={DELETE_CONFIRMATION}
				confirmLabel="Delete permanently"
				pending={pending}
				error={deletion.data && 'message' in deletion.data ? deletion.data.message : undefined}
				onConfirm={async (confirmation) => {
					if (target)
						await deletion.submit(
							{
								intent: target.attachment ? 'delete-attachment' : 'delete',
								id: target.id,
								confirmation
							},
							{ method: 'post' }
						);
				}}
				onDismiss={() => {
					if (!pending) setTarget(null);
				}}
				onClosed={() => {
					if (target && target.id === deletedId) {
						setTarget((current) => (current?.id === deletedId ? null : current));
						heading.current?.focus();
					}
				}}
			/>
		</section>
	);
}

function AttachmentUpload({ id }: { id: string }) {
	const upload = useFetcher<{ message?: string }>();
	const busy = upload.state !== 'idle';
	return (
		<upload.Form
			method="post"
			encType="multipart/form-data"
			action={`/items/${id}/attachment`}
			className="flex flex-wrap items-center justify-end gap-2"
		>
			<label className="grid gap-1">
				PDF or WebP up to 5 MiB
				<input
					aria-label="Attachment file"
					type="file"
					name="file"
					accept=".pdf,.webp,application/pdf,image/webp"
					required
				/>
			</label>
			<button className="ui-button ui-button-small" disabled={busy}>
				Attach file
			</button>
			{upload.data?.message && <p role="alert">{upload.data.message}</p>}
		</upload.Form>
	);
}
