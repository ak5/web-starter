import { useId, useRef, useState } from 'react';
import Modal from './Modal.js';

type ConfirmationProps = {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	requiredText?: string;
	pending?: boolean;
	error?: string;
	onConfirm: (text: string) => Promise<void>;
	onDismiss: () => void;
	onClosed?: () => void;
};

export default function ConfirmationDialog({
	open,
	title,
	description,
	confirmLabel,
	requiredText,
	pending,
	error,
	onConfirm,
	onDismiss,
	onClosed
}: ConfirmationProps) {
	const input = useRef<HTMLInputElement>(null);
	const cancel = useRef<HTMLButtonElement>(null);
	const descriptionId = useId();
	const [text, setText] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const inFlight = useRef(false);
	const busy = pending || submitting;
	const canConfirm = !busy && (requiredText === undefined || text === requiredText);

	function dismiss() {
		if (!pending && !inFlight.current) onDismiss();
	}

	return (
		<Modal
			open={open}
			title={title}
			describedBy={descriptionId}
			initialFocus={requiredText === undefined ? cancel : input}
			dismissDisabled={busy}
			onClose={dismiss}
			onClosed={() => {
				setText('');
				onClosed?.();
			}}
		>
			<form
				className="grid gap-4"
				onSubmit={async (event) => {
					event.preventDefault();
					if (!open || !canConfirm || inFlight.current) return;
					inFlight.current = true;
					setSubmitting(true);
					try {
						await onConfirm(text);
					} finally {
						inFlight.current = false;
						setSubmitting(false);
					}
				}}
			>
				<p id={descriptionId} className="wrap-break-word text-muted">
					{description}
				</p>
				{requiredText !== undefined && (
					<label className="grid gap-2 font-medium">
						Type {requiredText} to confirm
						<input
							ref={input}
							className="ui-field w-full"
							value={text}
							onChange={(event) => setText(event.target.value)}
							autoComplete="off"
							autoCapitalize="off"
							spellCheck={false}
							readOnly={busy}
						/>
					</label>
				)}
				{error && (
					<p role="alert" className="ui-message ui-message-error">
						{error}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					<button
						ref={cancel}
						type="button"
						className="ui-button"
						onClick={dismiss}
						disabled={busy}
					>
						Cancel
					</button>
					<button type="submit" className="ui-button ui-button-danger" disabled={!canConfirm}>
						{busy ? 'Working…' : confirmLabel}
					</button>
				</div>
			</form>
		</Modal>
	);
}
