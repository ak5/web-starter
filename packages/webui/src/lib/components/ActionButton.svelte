<script lang="ts">
	import { enhance, applyAction, type SubmitFunction } from '$app/forms';
	import { tick, type Snippet } from 'svelte';
	import Modal from './Modal.svelte';
	import type { HTMLButtonAttributes, HTMLFormAttributes } from 'svelte/elements';
	import { portal } from 'svelte-portal';

	type Props = {
		form?: string | true | undefined;
		action?: string;
		children: Snippet<[HTMLButtonAttributes]>;
		confirm?: string | Snippet<[HTMLButtonAttributes, HTMLButtonAttributes]>;
		name?: string;
		value?: string;
		enhance?: SubmitFunction;
		modalOpen?: boolean;
		data?: Record<string, string>;
		noEnhance?: boolean;
	};

	let {
		action,
		children,
		confirm,
		name,
		value,
		modalOpen = $bindable(false),
		enhance: customEnhance,
		form: _form,
		data,
		noEnhance = false
	}: Props = $props();

	const formId = $derived(_form === true ? undefined : (_form ?? crypto.randomUUID()));

	const openButtonProps: HTMLButtonAttributes = {
		type: 'button',
		onclick: () => {
			modalOpen = false;

			tick().then(() => {
				modalOpen = true;
			});
		}
	};

	const yesButtonProps: HTMLButtonAttributes = $derived({
		type: 'submit',
		formaction: action,
		...(name ? { name } : {}),
		...(value ? { value } : {}),
		...(formId ? { form: formId } : {})
	});

	const noButtonProps: HTMLButtonAttributes = {
		type: 'button',
		onclick: () => (modalOpen = false)
	};
	const formProps: HTMLFormAttributes = $derived({
		method: 'POST',
		...(formId ? { id: formId } : {})
	});

	const submitFunction: SubmitFunction = async (event) => {
		modalOpen = false;

		const customAfter = await customEnhance?.(event);

		return async (props) => {
			if (props.result?.type === 'redirect') {
				await applyAction(props.result);
			} else if (customAfter) {
				await customAfter(props);
			} else {
				// Default behavior: update the page data
				await props.update();
			}
		};
	};
</script>

<!-- Example usage:
	 
Simple case:

<ActionButton action="?/submit">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

Simple case with a name and value:

<ActionButton action="?/submit" name="submit" value="submit">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

Simple case with a custom enhance function:
<ActionButton action="?/submit" name="submit" value="submit" enhance={({cancel}) => cancel()}>
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

With a confirm dialog:

<ActionButton action="?/submit" confirm="Are you sure you want to do the thing?">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

With confirm dialog and custom enhance function, you need to pass in the modalOpen boolean if you want to close it

<script>
  let open = $state(false);
</script>
<ActionButton action="?/submit" confirm="Are you sure you want to do the thing?" modalOpen={open} enhance={() => {open = false}}>
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

With a custom confirm dialog:

<ActionButton action="?/submit">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
  {#snippet confirm(yes, no)}
	Are you sure you want to do the thing?
	<button {...yes}>Yes</button>
	<button {...no}>No</button>
  {/snippet}
</ActionButton>

You can have name and value and a confirm dialog and use an external form elsewhere on the page:

<ActionButton action="?/submit" name="submit" value="submit" form="my-form-id">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
  {#snippet confirm(yes, no)}
	Are you sure you want to do the thing?
	<button {...yes}>Yes</button>
	<button {...no}>No</button>
  {/snippet}
</ActionButton>

If you need to customize use:enhance or pass more than one field, use an external form:
<form id="my-form-id" use:enhance>
 <input type="hidden" name="field1" value="value1">
 <input type="hidden" name="field2" value="value2">
</form>
<ActionButton action="?/submit" name="buttonField" value="buttonValue" form="my-form-id">
  {#snippet children(buttonProps)}
	<button class="btn-primary-icon" {...buttonProps}>
	  Do the thing!
	</button>
  {/snippet}
</ActionButton>

If you want to wrap the button in a form, you can do so, just pass true for the form prop:

<form method="POST" action="?/submit" use:enhance>
  <input type="hidden" name="field1" value="value1">
  <ActionButton action="?/submit" name="buttonField" value="buttonValue" form={true}>
	{#snippet children(buttonProps)}
	  <button class="btn-primary-icon" {...buttonProps}>
		Do the thing!
	  </button>
	{/snippet}
	{#snippet confirm(yes, no)}
	  Are you sure you want to do the thing?
	  <button {...yes}>Yes</button>
	  <button {...no}>No</button>
	{/snippet}
</form>

<ActionButton action="?/submit" data={{field1: 'value1', field2: 'value2'}}>
	{#snippet children(buttonProps)}
		<button class="btn-primary-icon" {...buttonProps}>
			Do the thing!
		</button>
	{/snippet}
</ActionButton>

-->

{#snippet addHiddenFields()}
	{#if data}
		{#each Object.entries(data) as [key, value] (key)}
			<input type="hidden" name={key} {value} />
		{/each}
	{/if}
{/snippet}

{#if _form !== true || (_form === undefined && data)}
	<div use:portal={'body'}>
		{#if noEnhance}
			<form class="hidden" {...formProps}>
				{@render addHiddenFields()}
			</form>
		{:else}
			<form class="hidden" {...formProps} use:enhance={submitFunction}>
				{@render addHiddenFields()}
			</form>
		{/if}
	</div>
{:else if _form}
	{@render addHiddenFields()}
{/if}
{@render children(confirm ? openButtonProps : yesButtonProps)}
{#if typeof confirm === 'string'}
	<Modal open={modalOpen}>
		<div class="space-y-6">
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/20"
				>
					<svg class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
						></path>
					</svg>
				</div>
				<p class="text-lg font-medium text-base-content">{confirm}</p>
			</div>
			<div class="flex gap-3">
				<button {...noButtonProps} class="btn-base-200 btn flex-1 btn-outline"> Cancel </button>
				<button {...yesButtonProps} class="btn flex-1 btn-error"> Confirm </button>
			</div>
		</div>
	</Modal>
{:else if confirm}
	<Modal open={modalOpen}>
		{@render confirm(yesButtonProps, noButtonProps)}
	</Modal>
{/if}
