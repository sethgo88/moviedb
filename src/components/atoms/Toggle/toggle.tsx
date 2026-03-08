import { cn } from "../../../lib/cn";

interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: string;
	vertical?: boolean;
	className?: string;
}

export function Toggle({
	checked,
	onChange,
	label,
	className,
	vertical,
}: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className={cn(
				"flex items-center gap-3",
				vertical && "flex-col-reverse items-start",
				className,
			)}
			onClick={() => onChange(!checked)}
		>
			<span
				className={cn(
					"relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
					checked ? "bg-blue-600" : "bg-white/20",
				)}
			>
				<span
					className={cn(
						"pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
						checked ? "translate-x-5" : "translate-x-0",
					)}
				/>
			</span>
			{label && <span className="text-sm text-white/80">{label}</span>}
		</button>
	);
}
