import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({
	children,
	open,
	onClose,
	title
}: {
	children: ReactNode;
	open: boolean;
	onClose: () => void;
	title?: string;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const element = dialog.current;
		if (open && !element?.open) element?.showModal();
		if (!open && element?.open) element.close();
	}, [open]);

	return (
		<dialog
			ref={dialog}
			aria-labelledby={title ? titleId : undefined}
			aria-label={title ? undefined : 'Dialog'}
			className="m-auto max-h-[90vh] w-[calc(100%-1rem)] max-w-md overflow-hidden rounded-2xl border border-base-300 bg-base-100 text-base-content shadow-2xl backdrop:bg-base-300/80 backdrop:backdrop-blur-sm"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="relative text-left">
				<div className="flex items-center justify-between border-b border-base-300 bg-base-200/50 px-4 py-3 sm:px-6 sm:py-4">
					{title ? (
						<h3 id={titleId} className="text-lg font-semibold text-base-content">
							{title}
						</h3>
					) : (
						<div />
					)}
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="btn btn-circle btn-ghost btn-sm hover:bg-base-300"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="max-h-[calc(90vh-120px)] overflow-y-auto p-4 sm:p-6">{children}</div>
			</div>
		</dialog>
	);
}
