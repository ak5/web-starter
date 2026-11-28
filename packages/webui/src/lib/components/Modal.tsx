import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

export default function Modal({
	children,
	open,
	onClose,
	title,
	describedBy,
	initialFocus,
	dismissDisabled,
	onClosed
}: {
	children: ReactNode;
	open: boolean;
	onClose: () => void;
	title?: string;
	describedBy?: string;
	initialFocus?: RefObject<HTMLElement | null>;
	dismissDisabled?: boolean;
	onClosed?: () => void;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const element = dialog.current;
		if (open && element && !element.open) {
			element.showModal();
			initialFocus?.current?.focus();
		}
		if (!open && element?.open) element.close();
	}, [open, initialFocus]);

	return (
		<dialog
			ref={dialog}
			data-density="comfortable"
			aria-describedby={describedBy}
			aria-labelledby={title ? titleId : undefined}
			aria-label={title ? undefined : 'Dialog'}
			className="m-auto max-h-[90vh] w-[calc(100%-1rem)] max-w-md overflow-hidden rounded-2xl border border-raised bg-canvas text-ink shadow-2xl backdrop:bg-raised/80 backdrop:backdrop-blur-sm"
			onClose={onClosed}
			onCancel={(event) => {
				event.preventDefault();
				if (!dismissDisabled) onClose();
			}}
			onClick={(event) => {
				if (!dismissDisabled && event.target === event.currentTarget) onClose();
			}}
		>
			<div className="relative text-left">
				<div className="flex items-center justify-between gap-3 border-b border-raised bg-surface/50 px-4 py-3 sm:px-6 sm:py-4">
					{title ? (
						<h3 id={titleId} className="min-w-0 text-lg font-semibold wrap-break-word text-ink">
							{title}
						</h3>
					) : (
						<div />
					)}
					<button
						type="button"
						aria-label="Close"
						disabled={dismissDisabled}
						onClick={onClose}
						className="ui-button ui-button-icon ui-button-quiet ui-button-small hover:bg-raised"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="max-h-[calc(90vh-120px)] overflow-y-auto p-4 sm:p-6">{children}</div>
			</div>
		</dialog>
	);
}
