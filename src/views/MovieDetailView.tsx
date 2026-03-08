import { useNavigate, useParams } from "@tanstack/react-router";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft, Film, Pencil, Star } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/atoms/Badge";
import { Spinner } from "../components/atoms/Spinner";
import { ConfirmSheet } from "../components/molecules/ConfirmSheet";
import {
	useMovie,
	useSoftDeleteMovie,
} from "../features/movies/movies.queries";

function isPosterLocal(url: string) {
	return !url.startsWith("http");
}

export function MovieDetailView() {
	const navigate = useNavigate();
	const { id } = useParams({ strict: false });
	const { data: movie, isLoading } = useMovie(id);
	const { mutate: softDelete, isPending: isDeleting } = useSoftDeleteMovie();
	const [showDelete, setShowDelete] = useState(false);

	if (isLoading) return <Spinner />;
	if (!movie) {
		return (
			<div className="flex h-full items-center justify-center bg-gray-950 text-white/50">
				Movie not found.
			</div>
		);
	}

	function handleDelete() {
		if (!movie) return;
		softDelete(movie.id, {
			onSuccess: () => navigate({ to: "/" }),
		});
	}

	const posterSrc = movie.poster_url
		? isPosterLocal(movie.poster_url)
			? convertFileSrc(movie.poster_url)
			: movie.poster_url
		: null;

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			<div className="flex-1 overflow-y-auto">
				{/* Poster */}
				<div className="relative h-64 w-full bg-gray-800">
					{posterSrc ? (
						<img
							src={posterSrc}
							alt={movie.title}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<Film size={48} className="text-white/20" />
						</div>
					)}

					{/* Gradient for header readability */}
					<div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />

					{/* Header buttons */}
					<div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
							onClick={() => navigate({ to: "/" })}
						>
							<ArrowLeft size={20} />
						</button>
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
							onClick={() =>
								navigate({
									to: "/movie/$id/edit",
									params: { id: movie.id },
								})
							}
						>
							<Pencil size={16} />
						</button>
					</div>
				</div>

				{/* Movie info */}
				<div className="flex flex-col gap-4 p-4">
					{/* Title + year */}
					<div>
						<h1 className="text-2xl font-bold leading-tight">{movie.title}</h1>
						{movie.year && (
							<p className="mt-0.5 text-base text-white/50">{movie.year}</p>
						)}
					</div>

					{/* Badges */}
					<div className="flex flex-wrap gap-2">
						<Badge
							label={movie.status === "OWNED" ? "Owned" : "Want"}
							className={
								movie.status === "OWNED"
									? "bg-green-600/20 text-green-400"
									: "bg-yellow-600/20 text-yellow-400"
							}
						/>
						<Badge
							label={movie.format}
							className="bg-blue-600/20 text-blue-400"
						/>
						{movie.is_physical === 1 && (
							<Badge label="Physical" className="bg-white/10 text-white/70" />
						)}
						{movie.is_digital === 1 && (
							<Badge label="Digital" className="bg-white/10 text-white/70" />
						)}
					</div>

					{/* Personal rating */}
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

					{/* Notes */}
					{movie.notes && (
						<div className="rounded-lg border border-white/10 bg-gray-900 p-3">
							<p className="text-sm leading-relaxed text-white/70">
								{movie.notes}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Delete */}
			<div className="border-t border-white/10 p-4">
				<button
					type="button"
					className="min-h-[48px] w-full rounded-lg font-semibold text-red-500 transition-opacity active:opacity-70 disabled:opacity-40"
					disabled={isDeleting}
					onClick={() => setShowDelete(true)}
				>
					Delete Movie
				</button>
			</div>

			<ConfirmSheet
				isOpen={showDelete}
				title="Delete Movie"
				message={`Delete "${movie.title}"? This cannot be undone.`}
				confirmLabel="Delete"
				isDangerous
				onConfirm={handleDelete}
				onCancel={() => setShowDelete(false)}
			/>
		</div>
	);
}
