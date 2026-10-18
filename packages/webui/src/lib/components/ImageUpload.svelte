<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { portal } from 'svelte-portal';
	import type { ChangeEventHandler } from 'svelte/elements';
	import XIcon from '@lucide/svelte/icons/x';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import webpfy from 'webpfy';
	import { onMount, tick } from 'svelte';
	import { nanoid } from 'nanoid';

	type Props = {
		action: string;
		name: string;
		fileName?: string;
		value: string | undefined | null;
		userInputRef?: HTMLInputElement;
		imgWidth?: number;
		imgHeight?: number;
		autoupload?: boolean;
	};

	let {
		action,
		name,
		fileName: _fileName,
		value = $bindable(),
		userInputRef = $bindable(),
		imgWidth = 80,
		imgHeight = 80,
		autoupload = false
	}: Props = $props();
	const imageUploadId = nanoid();
	const fileName = $derived(
		_fileName ? (_fileName.endsWith('.webp') ? _fileName : _fileName + '.webp') : imageUploadId
	);
	const formId = $derived(`${fileName}-form`);

	let uploading = $state(false);
	let previewImage = $state<string>();
	let isDragging = $state(false);
	let mounted = $state(false);
	let imageUploadError = $state<string>();

	let changeImage = $state(false);
	let toggleChangeImage = () => (changeImage = !changeImage);

	let resizedFile = $state<File | undefined>();
	let formRef: HTMLFormElement = $state()!;

	async function resizeImageToExact(file: File, width: number, height: number): Promise<File> {
		return new Promise((resolve, reject) => {
			const img = new window.Image();
			img.onload = () => {
				// Calculate cropping to cover the target aspect ratio
				const srcAspect = img.width / img.height;
				const dstAspect = width / height;
				let sx = 0,
					sy = 0,
					sw = img.width,
					sh = img.height;
				if (srcAspect > dstAspect) {
					// Source is wider than target: crop sides
					sw = img.height * dstAspect;
					sx = (img.width - sw) / 2;
				} else if (srcAspect < dstAspect) {
					// Source is taller than target: crop top/bottom
					sh = img.width / dstAspect;
					sy = (img.height - sh) / 2;
				}
				// Create destination canvas
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Could not get canvas context'));
					return;
				}
				// Draw the cropped source image to the destination canvas, scaling to fit
				ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(new File([blob], file.name, { type: blob.type }));
					} else {
						reject(new Error('Failed to create blob'));
					}
				}, file.type);
			};
			img.onerror = reject;
			img.src = URL.createObjectURL(file);
		});
	}

	onMount(() => {
		mounted = true;
	});

	const onchange: ChangeEventHandler<HTMLInputElement> = async (event) => {
		imageUploadError = undefined;
		const file = event.currentTarget.files?.[0];
		if (file) {
			try {
				const resized = await resizeImageToExact(file, imgWidth, imgHeight);
				resizedFile = resized;
				previewImage = URL.createObjectURL(resized);
				if (autoupload && mounted) {
					formRef.requestSubmit();
				}
			} catch {
				imageUploadError = 'Failed to process image.';
				previewImage = undefined;
				resizedFile = undefined;
			}
		} else {
			previewImage = undefined;
			resizedFile = undefined;
		}
	};

	const handleUpload: SubmitFunction<{ url: string }> = async ({ formData, cancel }) => {
		uploading = true;
		const fileToUpload = resizedFile || (formData.get('imageUpload') as File);
		if (fileToUpload) {
			try {
				const webpFile = await webpfy({ image: fileToUpload });
				formData.set('imageUpload', webpFile.webpBlob, fileName);
			} catch {
				cancel();
			}
		}
		return async ({ result }) => {
			console.log(result);
			if (result.type === 'success' && result.data?.url) {
				changeImage = false;
				previewImage = undefined;
				resizedFile = undefined;
				value = ''; // this is a hack to force a re-render
				tick().then(() => {
					value = result.data!.url;
				});
			} else if (result.type === 'failure') {
				imageUploadError = result.data?.error;
			}
			uploading = false;
		};
	};

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		isDragging = true;
	};

	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault();
		isDragging = false;
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file && file.type.startsWith('image/')) {
			resizeImageToExact(file, imgWidth, imgHeight)
				.then((resized) => {
					resizedFile = resized;
					previewImage = URL.createObjectURL(resized);
					if (autoupload && mounted) {
						formRef?.requestSubmit();
					}
				})
				.catch(() => {
					imageUploadError = 'Failed to process image.';
					previewImage = undefined;
					resizedFile = undefined;
				});
		}
	};
</script>

{#if !value || changeImage}
	<div
		class="relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed {isDragging
			? 'border-primary bg-primary/10'
			: 'border-base-300 bg-base-200'}"
		style="height: {imgHeight}px; width: {imgWidth}px;"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="button"
		tabindex="0"
	>
		{#if previewImage}
			<img src={previewImage} alt="Preview" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
				<UploadIcon class="h-6 w-6 text-primary" />
				<span class="text-center text-sm text-primary">Click to upload or drag and drop</span>
			</div>
		{/if}
		<input
			id={imageUploadId}
			type="file"
			name="imageUpload"
			accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
			form={formId}
			{onchange}
			class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
			bind:this={userInputRef}
		/>
		{#if previewImage}
			<button
				form={formId}
				type="reset"
				class="absolute top-1 right-1 block rounded-full bg-error p-1 hover:bg-error/80"
			>
				<XIcon class="h-4 w-4" />
			</button>
		{/if}
	</div>

	{#if previewImage && previewImage !== value}
		{#if !autoupload}
			<button type="submit" form={formId} class="btn mt-2 btn-primary" disabled={uploading}>
				{uploading ? 'Uploading...' : 'Upload Image'}
			</button>
		{/if}
		{#if imageUploadError}
			<p class="text-xs text-error">{imageUploadError}</p>
		{/if}
	{/if}
{:else if value}
	<div class="relative h-[{imgHeight}px] w-[{imgWidth}px]">
		<input type="hidden" bind:this={userInputRef} />
		<img
			src={value}
			alt="Preview"
			height={imgHeight}
			width={imgWidth}
			class="rounded-md object-cover"
		/>
		<button
			type="button"
			onclick={toggleChangeImage}
			class="absolute top-1 right-1 block rounded-full bg-error p-1 hover:bg-error/10"
		>
			<XIcon class="h-4 w-4" />
		</button>
	</div>
{:else}
	<p>No image</p>
{/if}

<input type="hidden" {name} bind:value />

{#if mounted}
	<div use:portal={'body'}>
		<form
			id={formId}
			{action}
			class="hidden"
			method="POST"
			enctype="multipart/form-data"
			use:enhance={handleUpload}
			onreset={() => (previewImage = undefined)}
			bind:this={formRef}
		></form>
	</div>
{/if}
