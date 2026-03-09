import { useNavigate } from "@tanstack/react-router";
import { Disc3, Film, Star, Trash2, TvMinimalPlay } from "lucide-react";
import { useRef, useState } from "react";
import { useSoftDeleteMovie } from "../../../features/movies/movies.queries";
import type { Movie } from "../../../features/movies/movies.types";
import { Badge } from "../../atoms/Badge/badge";
import { ConfirmSheet } from "../../molecules/ConfirmSheet/confirm-sheet";

interface MovieCardProps {
	movie: Movie;
}

const SWIPE_THRESHOLD = 72; // px to trigger delete reveal
const DELETE_ZONE_WIDTH = 80; // px width of red delete zone

export function MovieCard({ movie }: MovieCardProps) {
	const navigate = useNavigate();
	const { mutate: softDelete } = useSoftDeleteMovie();
	const [offset, setOffset] = useState(0);
	const [showConfirm, setShowConfirm] = useState(false);
	const startX = useRef(0);
	const swiping = useRef(false);
	const didSwipe = useRef(false);

	const statusClassName =
		movie.status === "OWNED"
			? "bg-green-600/20 text-green-400"
			: "bg-yellow-600/20 text-yellow-400";

	function onTouchStart(e: React.TouchEvent) {
		startX.current = e.touches[0]?.clientX ?? 0;
		swiping.current = true;
		didSwipe.current = false;
	}

	function onTouchMove(e: React.TouchEvent) {
		if (!swiping.current) return;
		const dx = startX.current - (e.touches[0]?.clientX ?? 0);
		if (dx < 0) {
			// Swiping right — close if open
			setOffset(0);
			return;
		}
		const clamped = Math.min(dx, DELETE_ZONE_WIDTH);
		setOffset(clamped);
		if (clamped > 4) didSwipe.current = true;
	}

	function onTouchEnd() {
		swiping.current = false;
		if (offset >= SWIPE_THRESHOLD) {
			setOffset(DELETE_ZONE_WIDTH);
		} else {
			setOffset(0);
		}
	}

	function handleCardClick() {
		if (didSwipe.current) {
			didSwipe.current = false;
			return;
		}
		if (offset > 0) {
			setOffset(0);
			return;
		}
		navigate({ to: "/movie/$id/edit", params: { id: movie.id } });
	}

	function handleDelete() {
		softDelete(movie.id);
		setShowConfirm(false);
		setOffset(0);
	}

	return (
		<div className="relative overflow-hidden rounded-xl">
			{/* Delete zone (revealed on swipe) */}
			<div
				className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600"
				style={{ width: DELETE_ZONE_WIDTH }}
			>
				<button
					type="button"
					aria-label="Delete movie"
					className="flex h-full w-full items-center justify-center"
					onClick={() => setShowConfirm(true)}
				>
					<Trash2 size={22} className="text-white" />
				</button>
			</div>

			{/* Card (slides left to reveal delete zone) */}
			<button
				type="button"
				className="relative flex min-h-18 w-full overflow-hidden bg-gray-800 p-3 text-left transition-opacity active:opacity-80"
				style={{
					transform: `translateX(-${offset}px)`,
					transition: swiping.current ? "none" : "transform 0.2s ease",
				}}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				onClick={handleCardClick}
			>
				{/* Poster background */}
				{movie.poster_url ? (
					<img
						src={movie.poster_url}
						alt=""
						aria-hidden="true"
						className="absolute inset-0 h-full w-full object-cover object-center blur-[2px] brightness-75 grayscale-25"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<Film size={32} className="text-white/10" />
					</div>
				)}

				{/* Content */}
				<div className="relative flex w-full gap-3">
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold text-white">{movie.title}</p>
						{movie.year !== null && (
							<p className="text-sm text-white">{movie.year}</p>
						)}
						<div className="mt-1 flex gap-1.5">
							<Badge label={movie.status} className={statusClassName} />
							<Badge
								label={movie.format}
								className="bg-white/10 text-white/70"
							/>
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

			<ConfirmSheet
				isOpen={showConfirm}
				title="Delete Movie"
				message={`Delete "${movie.title}"? This cannot be undone.`}
				confirmLabel="Delete"
				isDangerous
				onConfirm={handleDelete}
				onCancel={() => {
					setShowConfirm(false);
					setOffset(0);
				}}
			/>
		</div>
	);
}
