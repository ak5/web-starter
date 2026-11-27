import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useFetcher } from 'react-router';
import { Upload, X } from 'lucide-react';

function resizeImageToExact(file: File, width: number, height: number): Promise<File> {
	return new Promise((resolve, reject) => {
		const img = new window.Image();
		const src = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(src);
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
		img.onerror = () => {
			URL.revokeObjectURL(src);
			reject(new Error('Could not read image'));
		};
		img.src = src;
	});
}

export default function ImageUpload({
	action,
	name,
	fileName,
	value,
	onChange,
	inputRef,
	imgWidth = 80,
	imgHeight = 80,
	autoupload = false
}: {
	action: string;
	name: string;
	fileName?: string;
	value: string | undefined | null;
	onChange: (url: string) => void;
	inputRef?: Ref<HTMLInputElement>;
	imgWidth?: number;
	imgHeight?: number;
	autoupload?: boolean;
}) {
	const id = useId();
	const fetcher = useFetcher<{ url?: string; error?: string }>();
	const [editing, setEditing] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [preparing, setPreparing] = useState(false);
	const [preview, setPreview] = useState<string>();
	const [file, setFile] = useState<File>();
	const [error, setError] = useState<string>();
	const sequence = useRef(0);
	const handled = useRef<typeof fetcher.data>(undefined);
	const busy = preparing || fetcher.state !== 'idle';
	useEffect(() => {
		setMounted(true);
		return () => {
			sequence.current++;
		};
	}, []);
	useEffect(
		() => () => {
			if (preview) URL.revokeObjectURL(preview);
		},
		[preview]
	);

	useEffect(() => {
		if (fetcher.state !== 'idle' || fetcher.data === handled.current) return;
		handled.current = fetcher.data;
		if (fetcher.data?.url) {
			setEditing(false);
			setPreview(undefined);
			setFile(undefined);
			onChange(fetcher.data.url);
		} else if (fetcher.data?.error) setError(fetcher.data.error);
	}, [fetcher.state, fetcher.data, onChange]);

	async function submit(image: File, attempt: number) {
		setPreparing(true);
		try {
			const { default: webpfy } = await import('webpfy');
			const { webpBlob } = await webpfy({ image });
			if (attempt !== sequence.current) return;
			const data = new FormData();
			const base = fileName ?? crypto.randomUUID();
			data.append('imageUpload', webpBlob, base.endsWith('.webp') ? base : base + '.webp');
			void fetcher.submit(data, { method: 'post', action, encType: 'multipart/form-data' });
		} catch {
			if (attempt === sequence.current) setError('Failed to process image.');
		} finally {
			if (attempt === sequence.current) setPreparing(false);
		}
	}

	async function select(image?: File) {
		const attempt = ++sequence.current;
		setError(undefined);
		setFile(undefined);
		setPreview(undefined);
		setPreparing(false);
		if (!image) return;
		setPreparing(true);
		try {
			const resized = await resizeImageToExact(image, imgWidth, imgHeight);
			if (attempt !== sequence.current) return;
			setFile(resized);
			setPreview(URL.createObjectURL(resized));
			if (autoupload) await submit(resized, attempt);
		} catch {
			if (attempt === sequence.current) setError('Failed to process image.');
		} finally {
			if (attempt === sequence.current) setPreparing(false);
		}
	}

	return (
		<>
			{!value || editing ? (
				<div>
					<div
						className={`relative overflow-hidden rounded-lg border-2 border-dashed ${dragging ? 'border-accent bg-accent/10' : 'border-raised bg-surface'}`}
						style={{ height: imgHeight, width: imgWidth }}
						onDragOver={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={(event) => {
							event.preventDefault();
							setDragging(false);
							const dropped = event.dataTransfer.files[0];
							if (!busy && dropped?.type.startsWith('image/')) void select(dropped);
						}}
					>
						{preview ? (
							<img src={preview} alt="Preview" className="h-full w-full object-cover" />
						) : (
							<div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
								<Upload className="h-6 w-6 text-accent" />
								<span className="text-center text-sm text-accent">
									Click to upload or drag and drop
								</span>
							</div>
						)}
						<input
							type="file"
							aria-label="Choose image"
							accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
							className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
							ref={inputRef}
							form={id}
							disabled={busy}
							onChange={(event) => {
								const chosen = event.currentTarget.files?.[0];
								event.currentTarget.value = '';
								void select(chosen);
							}}
						/>
						{preview && (
							<button
								type="button"
								aria-label="Clear image"
								disabled={busy}
								onClick={() => void select()}
								className="absolute top-1 right-1 block rounded-full bg-danger p-1 hover:bg-danger/80"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
					{file && !autoupload && (
						<button
							type="submit"
							form={id}
							className="ui-button ui-button-primary mt-2"
							disabled={busy}
						>
							{busy ? 'Uploading...' : 'Upload Image'}
						</button>
					)}
					{error && (
						<p role="alert" className="text-xs text-danger">
							{error}
						</p>
					)}
				</div>
			) : (
				<div className="relative" style={{ width: imgWidth, height: imgHeight }}>
					<img
						src={value}
						alt="Preview"
						height={imgHeight}
						width={imgWidth}
						className="rounded-md object-cover"
					/>
					<button
						type="button"
						aria-label="Change image"
						onClick={() => setEditing(true)}
						className="absolute top-1 right-1 block rounded-full bg-danger p-1 hover:bg-danger/10"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}
			<input type="hidden" name={name} value={value ?? ''} />
			{mounted &&
				createPortal(
					<form
						id={id}
						hidden
						onSubmit={(event) => {
							event.preventDefault();
							if (file && !busy) void submit(file, sequence.current);
						}}
					/>,
					document.body
				)}
		</>
	);
}
