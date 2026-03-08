import type { SelectHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

interface SelectOption {
	label: string;
	value: string | number;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	options: SelectOption[];
	error?: string;
}

export function Select({ options, error, className, ...props }: SelectProps) {
	return (
		<select
			className={cn(
				"w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-white outline-none transition-colors",
				error
					? "border-red-500 focus:border-red-400"
					: "border-white/10 focus:border-blue-500",
				className,
			)}
			{...props}
		>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
}
