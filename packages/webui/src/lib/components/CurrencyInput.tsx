import type { Ref } from 'react';
import { DollarSign } from 'lucide-react';

export default function CurrencyInput({
	value,
	onChange,
	name,
	placeholder,
	inputRef
}: {
	value: number;
	onChange: (value: number) => void;
	name?: string;
	placeholder?: string;
	inputRef?: Ref<HTMLInputElement>;
}) {
	return (
		<label className="input-bordered no-ring input flex items-center gap-2">
			<DollarSign className="h-4 w-4 opacity-70" />
			<input
				type="number"
				className="no-ring grow [appearance:textfield] border-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				step="0.01"
				value={Number.isNaN(value) ? '' : value}
				name={name}
				placeholder={placeholder}
				onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
				onBlur={() => onChange(Number(value.toFixed(2)))}
				ref={inputRef}
			/>
			<span className="badge badge-ghost badge-sm">USD</span>
		</label>
	);
}
