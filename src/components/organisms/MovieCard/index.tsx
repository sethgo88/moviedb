import { useNavigate } from "@tanstack/react-router";
import type { Movie } from "../../../features/movies/movies.types";
import { Badge } from "../../atoms/Badge";

interface MovieCardProps {
	movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
	const navigate = useNavigate();

	const statusClassName =
		movie.status === "OWNED"
			? "bg-green-600/20 text-green-400"
			: "bg-yellow-600/20 text-yellow-400";

	return (
		<button
			type="button"
			className="flex min-h-[72px] w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors active:bg-white/10"
			onClick={() => navigate({ to: "/movie/$id", params: { id: movie.id } })}
		>
			{/* Poster placeholder — replaced when poster cache is implemented */}
			<div className="h-16 w-11 shrink-0 rounded bg-white/10" />

			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold text-white">{movie.title}</p>
				{movie.year !== null && (
					<p className="text-sm text-white/60">{movie.year}</p>
				)}
				<div className="mt-1 flex gap-1.5">
					<Badge label={movie.status} className={statusClassName} />
					<Badge label={movie.format} className="bg-white/10 text-white/70" />
				</div>
			</div>
		</button>
	);
}
