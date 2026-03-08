import { cn } from "../../../lib/cn";

interface ToastProps {
	message: string;
	visible: boolean;
	variant?: "success" | "error";
}

export function Toast({ message, visible, variant = "success" }: ToastProps) {
	return (
		<div
			className={cn(
				"pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 transition-all duration-300",
				visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
			)}
			style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
		>
			<span
				className={cn(
					"rounded-2xl px-4 py-2 text-sm font-medium text-white shadow-lg",
					variant === "error" ? "bg-red-600" : "bg-green-600",
				)}
			>
				{message}
			</span>
		</div>
	);
}
