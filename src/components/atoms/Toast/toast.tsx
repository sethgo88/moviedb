import { cn } from "../../../lib/cn";

interface ToastProps {
	message: string;
	visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
	return (
		<div
			className={cn(
				"pointer-events-none fixed inset-x-0 z-50 flex justify-center transition-all duration-300",
				visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
			)}
			style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
		>
			<span className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
				{message}
			</span>
		</div>
	);
}
