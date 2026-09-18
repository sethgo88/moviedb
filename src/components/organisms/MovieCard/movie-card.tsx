import { useNavigate } from "@tanstack/react-router";
import { Disc3, Film, Star, Trash2, TvMinimalPlay } from "lucide-react";
import { useState } from "react";
import { useSoftDeleteMovie } from "../../../features/movies/movies.queries";
import type { Movie } from "../../../features/movies/movies.types";
import { Badge } from "../../atoms/Badge/badge";
import { ConfirmSheet } from "../../molecules/ConfirmSheet/confirm-sheet";

interface MovieCardProps {
	movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
	const navigate = useNavigate();
	const { mutate: softDelete } = useSoftDeleteMovie();
	const [showConfirm, setShowConfirm] = useState(false);

	const statusClassName =
		movie.status === "OWNED"
			? "bg-green-600/20 text-green-400"
			: "bg-yellow-600/20 text-yellow-400";

	function handleDelete() {
		softDelete(movie.id);
		setShowConfirm(false);
	}

	return (
		<div className="relative overflow-hidden rounded-xl">
			{/* Card — navigates to edit */}
			<button
				type="button"
				className="relative flex min-h-60 w-full overflow-hidden bg-gray-800 p-3 text-left transition-opacity active:opacity-80"
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
						className="absolute inset-0 h-full w-full object-cover object-center brightness-40 grayscale-25"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<Film size={32} className="text-white/10" />
					</div>
				)}

				{/* Content */}
				<div className="relative flex flex-col w-full gap-3">
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-white">{movie.title}</p>
						{movie.year !== null && (
							<p className="text-sm text-white">{movie.year}</p>
						)}
						<div className="mt-1 flex flex-wrap gap-1.5">
							<Badge label={movie.status} className={statusClassName} />
							<Badge
								label={movie.format}
								className="bg-white/10 text-white/70"
							/>
							{movie.type === "TV_SEASON" && movie.season_number !== null && (
								<Badge
									label={`S${movie.season_number}`}
									className="bg-blue-600/20 text-blue-400"
								/>
							)}
						</div>
					</div>

					<div className="mt-1.5 flex flex-1 flex-col gap-1.5">
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
						{movie.tmdb_rating !== null && (
							<div className="flex items-center gap-1">
								<span className="text-xs text-white">TMDB</span>
								<span className="text-xs text-white">
									★{" "}
									{movie.tmdb_rating % 1 === 0
										? movie.tmdb_rating
										: movie.tmdb_rating.toFixed(1)}
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

			{/* Trash button — sibling of card button, not a child */}
			<button
				type="button"
				aria-label="Delete movie"
				className="absolute bottom-2 right-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-black/40 text-white/70 active:text-white"
				onClick={() => setShowConfirm(true)}
			>
				<Trash2 size={16} />
			</button>

			<ConfirmSheet
				isOpen={showConfirm}
				title="Delete Movie"
				message={`Delete "${movie.title}"? This cannot be undone.`}
				confirmLabel="Delete"
				isDangerous
				onConfirm={handleDelete}
				onCancel={() => setShowConfirm(false)}
			/>
		</div>
	);
}
