import { cn } from "../../../lib/cn";

interface SliderProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	className?: string;
}

export function Slider({
	value,
	onChange,
	min = 1,
	max = 10,
	step = 0.5,
	className,
}: SliderProps) {
	return (
		<div className={cn("flex items-center gap-3", className)}>
			<span className="w-4 text-sm text-white/40">{min}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="flex-1 accent-blue-600"
			/>
			<span className="w-6 text-right text-sm font-semibold text-white">
				{value % 1 === 0 ? value : value.toFixed(1)}
			</span>
		</div>
	);
}
