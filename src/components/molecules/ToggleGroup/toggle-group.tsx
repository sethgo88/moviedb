import { cn } from "../../../lib/cn";

interface ToggleGroupOption<T extends string> {
	label: string;
	value: T;
}

interface ToggleGroupProps<T extends string> {
	options: ToggleGroupOption<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
}

export function ToggleGroup<T extends string>({
	options,
	value,
	onChange,
	className,
}: ToggleGroupProps<T>) {
	return (
		<div
			className={cn("flex rounded-lg border border-white/10 p-0.5", className)}
		>
			{options.map((opt) => (
				<button
					key={opt.value}
					type="button"
					className={cn(
						"flex-1 rounded-md py-2 text-sm font-medium transition-colors",
						value === opt.value
							? "bg-blue-600 text-white"
							: "text-white/50 hover:text-white/80",
					)}
					onClick={() => onChange(opt.value)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
