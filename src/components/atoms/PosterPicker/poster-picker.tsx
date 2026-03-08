import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/cn";

interface DetectedType {
	mime: string;
	label: string;
}

function detectImageType(bytes: Uint8Array): DetectedType | null {
	// JPEG: FF D8 FF
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { mime: "image/jpeg", label: "JPEG" };
	}
	// PNG: 89 50 4E 47
	if (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return { mime: "image/png", label: "PNG" };
	}
	// WebP: RIFF????WEBP
	if (
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return { mime: "image/webp", label: "WebP" };
	}
	return null;
}

interface PosterPickerProps {
	value: string | null;
	onChange: (dataUrl: string) => void;
	className?: string;
}

export function PosterPicker({
	value,
	onChange,
	className,
}: PosterPickerProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handlePick() {
		setError(null);
		const selected = await open({
			multiple: false,
			filters: [
				{
					name: "Image",
					extensions: ["jpg", "jpeg", "png", "webp"],
				},
			],
		});
		if (!selected || typeof selected !== "string") return;

		console.log("[PosterPicker] selected path:", selected);

		setIsLoading(true);
		try {
			const bytes = await readFile(selected);
			console.log("[PosterPicker] bytes read:", bytes.length);

			const detected = detectImageType(bytes);
			console.log("[PosterPicker] detected type:", detected);

			if (!detected) {
				const header = Array.from(bytes.slice(0, 4))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join(" ");
				console.error("[PosterPicker] unrecognised file header:", header);
				setError(
					`Unsupported format (header: ${header}). Use JPG, PNG, or WebP.`,
				);
				return;
			}

			const blob = new Blob([bytes], { type: detected.mime });
			const blobUrl = URL.createObjectURL(blob);
			console.log(
				"[PosterPicker] blob created — mime:",
				detected.mime,
				"size:",
				blob.size,
			);

			const img = new Image();
			await new Promise<void>((res, rej) => {
				img.onload = () => {
					console.log(
						"[PosterPicker] image loaded:",
						img.naturalWidth,
						"x",
						img.naturalHeight,
					);
					res();
				};
				img.onerror = (e) => {
					console.error("[PosterPicker] image load error:", e);
					rej(
						new Error(`Browser could not decode the ${detected.label} image`),
					);
				};
				img.src = blobUrl;
			});
			URL.revokeObjectURL(blobUrl);

			const canvas = document.createElement("canvas");
			canvas.width = 185;
			canvas.height = Math.round((img.naturalHeight * 185) / img.naturalWidth);
			console.log(
				"[PosterPicker] canvas size:",
				canvas.width,
				"x",
				canvas.height,
			);

			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas not available");
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			// Encode as JPEG data URL — stored directly in poster_url.
			// The Tauri asset protocol cannot serve runtime-written files on Android,
			// so we store the data URL instead of a file path for custom posters.
			const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
			console.log("[PosterPicker] dataUrl length:", dataUrl.length);

			onChange(dataUrl);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error("[PosterPicker] error:", message);
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="flex flex-col gap-1">
			<button
				type="button"
				onClick={handlePick}
				disabled={isLoading}
				className={cn(
					"relative flex aspect-[2/3] w-28 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gray-800 transition-opacity",
					isLoading && "opacity-60",
					error && "border-red-500",
					className,
				)}
			>
				{value ? (
					<img
						src={value}
						alt="Movie poster"
						className="h-full w-full object-cover"
						onError={(e) => {
							console.error(
								"[PosterPicker] <img> load error, src length:",
								(e.target as HTMLImageElement).src.length,
							);
						}}
					/>
				) : (
					<div className="flex flex-col items-center gap-2 text-white/30">
						<ImagePlus size={28} />
						<span className="text-xs">Add Poster</span>
					</div>
				)}
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/60">
						<span className="text-xs text-white">Resizing…</span>
					</div>
				)}
			</button>
			{error && (
				<p className="w-28 text-center text-xs leading-tight text-red-400">
					{error}
				</p>
			)}
		</div>
	);
}
