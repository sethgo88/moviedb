import { cn } from "../../../lib/cn";

interface ConfirmSheetProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	isDangerous?: boolean;
	secondaryLabel?: string;
	onSecondary?: () => void;
}

export function ConfirmSheet({
	isOpen,
	title,
	message,
	confirmLabel,
	onConfirm,
	onCancel,
	isDangerous = false,
	secondaryLabel,
	onSecondary,
}: ConfirmSheetProps) {
	return (
		<>
			{/* Overlay */}
			<button
				type="button"
				aria-label="Close"
				className={cn(
					"fixed inset-0 z-40 w-full bg-black/60 transition-opacity duration-300",
					isOpen ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				onClick={onCancel}
			/>

			{/* Sheet */}
			<div
				className={cn(
					"fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-gray-800 p-6 transition-transform duration-300",
					isOpen ? "translate-y-0" : "translate-y-full",
				)}
				style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
			>
				<div className="mb-1 text-center text-lg font-semibold text-white">
					{title}
				</div>
				<p className="mb-6 text-center text-sm text-white/60">{message}</p>

				<div className="flex flex-col gap-3">
					<button
						type="button"
						className={cn(
							"min-h-[48px] w-full rounded-xl font-semibold transition-opacity active:opacity-80",
							isDangerous ? "bg-red-600 text-white" : "bg-blue-600 text-white",
						)}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
					{secondaryLabel && onSecondary && (
						<button
							type="button"
							className="min-h-[48px] w-full rounded-xl bg-blue-600 font-semibold text-white transition-opacity active:opacity-80"
							onClick={onSecondary}
						>
							{secondaryLabel}
						</button>
					)}
					<button
						type="button"
						className="min-h-[48px] w-full rounded-xl font-semibold text-white/70 transition-opacity active:opacity-80"
						onClick={onCancel}
					>
						Cancel
					</button>
				</div>
			</div>
		</>
	);
}
