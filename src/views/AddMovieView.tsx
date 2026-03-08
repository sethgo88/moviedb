import { useNavigate } from "@tanstack/react-router";
import type { MovieFormValues } from "../components/organisms/MovieForm/movie-form";
import { MovieForm } from "../components/organisms/MovieForm/movie-form";
import { useCreateMovie } from "../features/movies/movies.queries";
import { NewMovieSchema } from "../features/movies/movies.schema";

export function AddMovieView() {
	const navigate = useNavigate();
	const { mutateAsync: createMovie } = useCreateMovie();

	async function handleSubmit(values: MovieFormValues) {
		const payload = NewMovieSchema.parse({
			title: values.title.trim(),
			year: Number(values.year),
			tmdb_id: null,
			poster_url: values.poster_url,
			tmdb_rating: null,
			personal_rating: values.personal_rating,
			status: values.status,
			format: values.format,
			is_physical: values.is_physical ? 1 : 0,
			is_digital: values.is_digital ? 1 : 0,
			is_backed_up: 0,
			notes: values.notes.trim() || null,
		});
		await createMovie(payload);
		navigate({ to: "/" });
	}

	return (
		<MovieForm
			title="Add Movie"
			submitLabel="Add"
			onCancel={() => navigate({ to: "/" })}
			onSubmit={handleSubmit}
		/>
	);
}
