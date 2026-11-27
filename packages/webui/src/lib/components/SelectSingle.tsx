import { useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Option = { label: string; value: string };

export default function SelectSingle({
	options,
	value,
	onChange,
	name,
	placeholder,
	inputRef
}: {
	options: Option[];
	value?: string;
	onChange: (value: string) => void;
	name?: string;
	placeholder?: string;
	inputRef?: Ref<HTMLInputElement>;
}) {
	const id = useId();
	const input = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const selected = options.find((option) => option.value === value);
	const visible = options.filter((option) =>
		option.label.toLowerCase().includes(query.trim().toLowerCase())
	);

	function close() {
		setOpen(false);
		setQuery('');
		setActive(-1);
	}

	function select(option: Option) {
		onChange(option.value);
		input.current?.focus();
		close();
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape' && open) close();
		else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			setOpen(true);
			const offset = event.key === 'ArrowDown' ? 1 : -1;
			setActive(Math.max(0, Math.min(visible.length - 1, active + offset)));
		} else if (event.key === 'Enter' && open && visible[active]) {
			event.preventDefault();
			select(visible[active]);
		}
	}

	return (
		<div
			className="relative"
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) close();
			}}
		>
			<div className="flex w-full gap-1">
				<div className="no-ring ui-field w-full">
					{selected && <span className="text-ink/60">{selected.label}</span>}
					<input type="hidden" name={name} value={value ?? ''} />
					<input
						ref={(element) => {
							input.current = element;
							if (typeof inputRef === 'function') inputRef(element);
							else if (inputRef) inputRef.current = element;
						}}
						placeholder={placeholder}
						aria-label={placeholder || 'Search options'}
						role="combobox"
						aria-autocomplete="list"
						aria-expanded={open}
						aria-controls={id}
						aria-activedescendant={open && visible[active] ? `${id}-${active}` : undefined}
						className="no-ring ui-field w-full"
						value={query}
						onFocus={() => setOpen(true)}
						onChange={(event) => {
							setQuery(event.currentTarget.value);
							setActive(-1);
							setOpen(true);
						}}
						onKeyDown={onKeyDown}
					/>
				</div>
				<button
					aria-label="Toggle options"
					type="button"
					className="ui-button ui-button-icon"
					onClick={() => {
						if (open) close();
						else {
							input.current?.focus();
							setOpen(true);
						}
					}}
				>
					<ChevronDown size="1.2rem" />
				</button>
			</div>
			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md bg-canvas shadow">
					<div role="listbox" id={id} aria-label="Options">
						{visible.map((option, index) => (
							<div
								key={option.value}
								id={`${id}-${index}`}
								role="option"
								aria-selected={value === option.value}
								className={`flex cursor-pointer items-center px-2 py-1 text-ink/80 hover:bg-raised ${index === active || option.value === value ? 'bg-surface' : ''}`}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => select(option)}
							>
								{option.label}
								{option.value === value && <Check />}
							</div>
						))}
					</div>
					{visible.length === 0 && (
						<span className="block px-2 py-1 text-ink/60">No results found</span>
					)}
				</div>
			)}
		</div>
	);
}
