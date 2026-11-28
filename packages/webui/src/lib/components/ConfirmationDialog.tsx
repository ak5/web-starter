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
	const [submitFailed, setSubmitFailed] = useState(false);
	const inFlight = useRef(false);
	const busy = pending || submitting;
	const message = submitFailed ? 'Could not complete this action. Please try again.' : error;
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
				setSubmitFailed(false);
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
					setSubmitFailed(false);
					try {
						await onConfirm(text);
					} catch {
						setSubmitFailed(true);
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
				{message && (
					<p role="alert" className="ui-message ui-message-error">
						{message}
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
