import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/cn";

interface PosterPickerProps {
	value: string | null;
	onChange: (path: string) => void;
	className?: string;
}

export function PosterPicker({
	value,
	onChange,
	className,
}: PosterPickerProps) {
	const [isLoading, setIsLoading] = useState(false);

	async function handlePick() {
		const selected = await open({
			multiple: false,
			filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp"] }],
		});
		if (!selected || typeof selected !== "string") return;

		setIsLoading(true);
		try {
			// Read file bytes — handles Android content URIs transparently
			const bytes = await readFile(selected);
			const blob = new Blob([bytes]);
			const blobUrl = URL.createObjectURL(blob);

			// Load into an Image element to get natural dimensions
			const img = new Image();
			await new Promise<void>((res, rej) => {
				img.onload = () => res();
				img.onerror = () => rej(new Error("Failed to load image"));
				img.src = blobUrl;
			});
			URL.revokeObjectURL(blobUrl);

			// Resize to 185px wide (TMDB w185), preserve aspect ratio
			const canvas = document.createElement("canvas");
			canvas.width = 185;
			canvas.height = Math.round((img.naturalHeight * 185) / img.naturalWidth);
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas not available");
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			// Encode as JPEG and send to Rust for saving
			const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
			const base64Data = dataUrl.split(",")[1] ?? "";
			const savedPath = await invoke<string>("save_custom_poster", {
				base64Data,
			});

			onChange(savedPath);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<button
			type="button"
			onClick={handlePick}
			disabled={isLoading}
			className={cn(
				"relative flex aspect-[2/3] w-28 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gray-800 transition-opacity",
				isLoading && "opacity-60",
				className,
			)}
		>
			{value ? (
				<img
					src={convertFileSrc(value)}
					alt="Movie poster"
					className="h-full w-full object-cover"
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
	);
}
