import {
	useId,
	useState,
	type ButtonHTMLAttributes,
	type FormEventHandler,
	type ReactNode
} from 'react';
import { Form } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import Modal from './Modal.js';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function ActionButton({
	action,
	children,
	confirm,
	name,
	value,
	form,
	data,
	reloadDocument,
	onSubmit
}: {
	action?: string;
	children: (props: ButtonProps) => ReactNode;
	confirm?: string | ((yes: ButtonProps, no: ButtonProps) => ReactNode);
	name?: string;
	value?: string;
	form?: string | true;
	data?: Record<string, string>;
	reloadDocument?: boolean;
	onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
	const id = useId();
	const formId = form === true ? undefined : (form ?? id);
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);
	const yes: ButtonProps = { type: 'submit', formAction: action, name, value, form: formId };
	const no: ButtonProps = { type: 'button', onClick: close };
	const fields = Object.entries(data ?? {}).map(([key, field]) => (
		<input key={key} type="hidden" name={key} value={field} />
	));
	return (
		<>
			{form === undefined ? (
				<Form
					hidden
					id={formId}
					method="post"
					action={action}
					reloadDocument={reloadDocument}
					onSubmit={(event) => {
						onSubmit?.(event);
						if (!event.defaultPrevented) close();
					}}
				>
					{fields}
				</Form>
			) : (
				form === true && fields
			)}
			{children(confirm ? { type: 'button', onClick: () => setOpen(true) } : yes)}
			{confirm && (
				<Modal open={open} onClose={close}>
					{typeof confirm === 'function' ? (
						confirm(yes, no)
					) : (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
									<TriangleAlert className="h-6 w-6 text-warning" />
								</div>
								<p className="text-lg font-medium text-base-content">{confirm}</p>
							</div>
							<div className="flex gap-3">
								<button {...no} className="btn-base-200 btn flex-1 btn-outline">
									Cancel
								</button>
								<button {...yes} className="btn flex-1 btn-error">
									Confirm
								</button>
							</div>
						</div>
					)}
				</Modal>
			)}
		</>
	);
}
