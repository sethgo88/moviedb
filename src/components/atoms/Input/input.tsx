import type { InputHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
	return (
		<input
			className={cn(
				"w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors",
				error
					? "border-red-500 focus:border-red-400"
					: "border-white/10 focus:border-blue-500",
				className,
			)}
			{...props}
		/>
	);
}
