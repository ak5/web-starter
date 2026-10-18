<script lang="ts">
	import { Combobox } from 'melt/builders';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CheckIcon from '@lucide/svelte/icons/check';

	type Option = { label: string; value: string };

	type Props = {
		options: Option[];
		value?: string;
		name?: string;
		placeholder?: string;
		inputField?: HTMLInputElement;
	};

	let {
		options,
		value = $bindable(),
		name,
		placeholder,
		inputField = $bindable()
	}: Props = $props();

	const combobox = new Combobox<string>({
		value: () => value,
		onValueChange: (v) => (value = v)
	});
	// default value
	if (value) combobox.inputValue = value;

	const filtered = $derived.by(() => {
		if (!combobox.touched) return options;
		return options.filter((o) =>
			o.label.toLowerCase().includes(combobox.inputValue.trim().toLowerCase())
		);
	});
</script>

<div class="join w-full">
	<label class="no-ring input join-item w-full">
		<p class="text-base-content/60">{options.find((o) => o.value === value)?.label}</p>
		<input type="hidden" {name} {value} />
		<input {...combobox.input} {placeholder} class="no-ring input w-full" bind:this={inputField} />
	</label>
	<button type="button" {...combobox.trigger} class="btn join-item btn-square btn-outline btn-soft">
		<ChevronDown size="1.2rem" />
	</button>
</div>
<div {...combobox.content} class="z-10 mt-1 w-full rounded-box bg-base-100 shadow">
	{#each filtered as option (option)}
		<div
			{...combobox.getOption(option.value)}
			class={{
				'menu-item flex cursor-pointer items-center px-2 py-1 text-base-content/80 hover:bg-base-300': true,
				'bg-base-200': combobox.isSelected(option.value)
			}}
		>
			{option.label}
			{#if combobox.isSelected(option.value)}
				<CheckIcon />
			{/if}
		</div>
	{:else}
		<span class="block px-2 py-1 text-base-content/60">No results found</span>
	{/each}
</div>
