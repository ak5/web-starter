<script lang="ts">
	import DollarSign from '@lucide/svelte/icons/dollar-sign';

	type Props = {
		value: number;
		name?: string;
		placeholder?: string;
		inputField?: HTMLInputElement;
	};

	let { value = $bindable(), name, placeholder, inputField = $bindable() }: Props = $props();

	function onblur() {
		value = parseFloat(value.toFixed(2));
	}
</script>

<label class="input-bordered no-ring input flex items-center gap-2">
	<DollarSign class="h-4 w-4 opacity-70" />
	<input
		type="number"
		class="no-ring grow [appearance:textfield] border-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		step="0.01"
		bind:value
		{name}
		{placeholder}
		{onblur}
		bind:this={inputField}
	/>
	<span class="badge badge-ghost badge-sm">USD</span>
</label>
