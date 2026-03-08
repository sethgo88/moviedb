import { useNavigate } from "@tanstack/react-router";
import { Disc3, Film, Star, TvMinimalPlay } from "lucide-react";
import type { Movie } from "../../../features/movies/movies.types";
import { Badge } from "../../atoms/Badge/badge";

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
			className="relative flex min-h-18 w-full overflow-hidden rounded-xl bg-gray-800 p-3 text-left transition-opacity active:opacity-80"
			onClick={() =>
				navigate({ to: "/movie/$id/edit", params: { id: movie.id } })
			}
		>
			{/* Poster background */}
			{movie.poster_url ? (
				<img
					src={movie.poster_url}
					alt=""
					aria-hidden="true"
					className="absolute inset-0 h-full w-full object-cover object-center"
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center">
					<Film size={32} className="text-white/10" />
				</div>
			)}

			{/* Overlay */}
			<div className="absolute inset-0 bg-black/30" />

			{/* Content */}
			<div className="relative flex w-full items-start gap-3">
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

				<div className="flex h-full flex-1 flex-col gap-2">
					{movie.personal_rating !== null && (
						<div className="flex items-center gap-1.5">
							<Star size={16} className="fill-yellow-400 text-yellow-400" />
							<span className="text-sm font-medium">
								{movie.personal_rating % 1 === 0
									? movie.personal_rating
									: movie.personal_rating.toFixed(1)}{" "}
								/ 10
							</span>
						</div>
					)}
					<div className="flex gap-2">
						{movie.is_physical === 1 && <Disc3 size={16} />}
						{movie.is_digital === 1 && <TvMinimalPlay size={16} />}
					</div>
				</div>
			</div>
		</button>
	);
}
