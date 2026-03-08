import { cn } from "../../../lib/cn";

interface BadgeProps {
	label: string;
	className?: string;
}

export function Badge({ label, className }: BadgeProps) {
	return (
		<span className={cn("rounded px-2 py-0.5 text-xs font-medium", className)}>
			{label}
		</span>
	);
}
