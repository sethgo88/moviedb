import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Spinner } from "../components/atoms/Spinner/spinner";
import { Toast } from "../components/atoms/Toast/toast";
import type { MovieFormValues } from "../components/organisms/MovieForm/movie-form";
import { MovieForm } from "../components/organisms/MovieForm/movie-form";
import { useMovie, useUpdateMovie } from "../features/movies/movies.queries";
import { UpdateMovieSchema } from "../features/movies/movies.schema";

export function EditMovieView() {
	const navigate = useNavigate();
	const { id } = useParams({ strict: false });
	const { data: movie, isLoading } = useMovie(id);
	const { mutateAsync: updateMovie } = useUpdateMovie();
	const [toastVisible, setToastVisible] = useState(false);

	if (isLoading) return <Spinner />;
	if (!movie || !id) {
		return (
			<div className="flex h-full items-center justify-center bg-gray-950 text-white/50">
				Movie not found.
			</div>
		);
	}

	// Capture narrowed id for use in closures (useParams returns string | undefined)
	const movieId = movie.id;

	const initialValues: Partial<MovieFormValues> = {
		title: movie.title,
		year: movie.year ? String(movie.year) : String(new Date().getFullYear()),
		status: movie.status,
		format: movie.format,
		is_physical: movie.is_physical === 1,
		is_digital: movie.is_digital === 1,
		personal_rating: movie.personal_rating,
		notes: movie.notes ?? "",
		poster_url: movie.poster_url,
		tmdb_id: movie.tmdb_id,
		tmdb_rating: movie.tmdb_rating,
	};

	async function handleSubmit(values: MovieFormValues) {
		const payload = UpdateMovieSchema.parse({
			title: values.title.trim(),
			year: Number(values.year),
			status: values.status,
			format: values.format,
			is_physical: values.is_physical ? 1 : 0,
			is_digital: values.is_digital ? 1 : 0,
			poster_url: values.poster_url,
			tmdb_id: values.tmdb_id,
			tmdb_rating: values.tmdb_rating,
			personal_rating: values.personal_rating,
			notes: values.notes.trim() || null,
		});
		await updateMovie({ id: movieId, data: payload });
		setToastVisible(true);
		setTimeout(() => setToastVisible(false), 2000);
	}

	return (
		<>
			<Toast message="Saved!" visible={toastVisible} />
			<MovieForm
				title="Edit Movie"
				submitLabel="Save"
				initialValues={initialValues}
				onCancel={() => navigate({ to: "/" })}
				onSubmit={handleSubmit}
			/>
		</>
	);
}
