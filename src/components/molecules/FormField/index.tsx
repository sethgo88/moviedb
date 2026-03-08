import type { ReactNode } from "react";

interface FormFieldProps {
	label: string;
	error?: string;
	children: ReactNode;
}

export function FormField({ label, error, children }: FormFieldProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-sm font-medium text-white/70">{label}</span>
			{children}
			{error && <p className="text-xs text-red-400">{error}</p>}
		</div>
	);
}
