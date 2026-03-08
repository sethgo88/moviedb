import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary";
}

export function Button({
	variant = "primary",
	className,
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				"min-h-[48px] min-w-[48px] rounded-lg px-4 font-semibold transition-all active:scale-95",
				variant === "primary" && "bg-blue-600 text-white active:bg-blue-700",
				className,
			)}
			{...props}
		/>
	);
}
