import { useForm } from "@tanstack/react-form";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PosterPicker } from "@/components/atoms/PosterPicker/poster-picker";
import { Select } from "@/components/atoms/Select/select";
import { Slider } from "@/components/atoms/Slider/slider";
import { Toggle } from "@/components/atoms/Toggle/toggle";
import { ConfirmSheet } from "@/components/molecules/ConfirmSheet/confirm-sheet";
import { FormField } from "@/components/molecules/FormField/form-field";
import { ToggleGroup } from "@/components/molecules/ToggleGroup/toggle-group";
import { useCreateMovie } from "@/features/movies/movies.queries";
import { NewMovieSchema } from "@/features/movies/movies.schema";
import { getShowByTmdbId } from "@/features/movies/movies.service";
import type { MovieFormat, MovieStatus } from "@/features/movies/movies.types";
import { useTmdbSearch, useTmdbTvSearch } from "@/features/tmdb/tmdb.queries";
import {
	fetchAndCachePoster,
	fetchSeasonDetails,
	TMDB_POSTER_BASE,
} from "@/features/tmdb/tmdb.service";
import type {
	TmdbSearchResult,
	TmdbTvSearchResult,
} from "@/features/tmdb/tmdb.types";

const STATUS_OPTIONS: { label: string; value: MovieStatus }[] = [
	{ label: "Owned", value: "OWNED" },
	{ label: "Want", value: "WANTED" },
];

const FORMAT_OPTIONS: { label: string; value: MovieFormat }[] = [
	{ label: "SD", value: "SD" },
	{ label: "HD", value: "HD" },
	{ label: "4K", value: "4K" },
	{ label: "Custom", value: "CUSTOM" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1927 + 1 }, (_, i) => {
	const y = String(CURRENT_YEAR - i);
	return { label: y, value: y };
});

interface AddFormValues {
	title: string;
	year: string;
	status: MovieStatus;
	format: MovieFormat;
	is_physical: boolean;
	is_digital: boolean;
	personal_rating: number | null;
	notes: string;
	poster_url: string | null;
	tmdb_id: number | null;
	tmdb_rating: number | null;
}

const DEFAULTS: AddFormValues = {
	title: "",
	year: String(CURRENT_YEAR),
	status: "OWNED",
	format: "HD",
	is_physical: false,
	is_digital: false,
	personal_rating: null,
	notes: "",
	poster_url: null,
	tmdb_id: null,
	tmdb_rating: null,
};

export function AddMovieView() {
	const navigate = useNavigate();
	const { mutateAsync: createMovie } = useCreateMovie();

	const [mode, setMode] = useState<"MOVIE" | "TV">("MOVIE");
	const [titleQuery, setTitleQuery] = useState("");
	const [isTitleFocused, setIsTitleFocused] = useState(false);
	const [loadingId, setLoadingId] = useState<number | null>(null);

	// TV-specific state
	const [selectedShow, setSelectedShow] = useState<TmdbTvSearchResult | null>(
		null,
	);
	const [seasonNumber, setSeasonNumber] = useState("");
	const [isFetchingSeasonPoster, setIsFetchingSeasonPoster] = useState(false);
	const [showPosterUrl, setShowPosterUrl] = useState<string | null>(null);

	// Both hooks always called; pass empty string to disable whichever isn't active
	const { data: movieResults, isFetching: isFetchingMovies } = useTmdbSearch(
		mode === "MOVIE" ? titleQuery : "",
	);
	const { data: tvResults, isFetching: isFetchingTv } = useTmdbTvSearch(
		mode === "TV" ? titleQuery : "",
	);

	const searchResults = mode === "MOVIE" ? movieResults : tvResults;
	const isSearching = mode === "MOVIE" ? isFetchingMovies : isFetchingTv;
	const showDropdown =
		isTitleFocused && !!searchResults && searchResults.length > 0;

	const form = useForm({
		defaultValues: DEFAULTS,
		onSubmit: async ({ value, formApi }) => {
			if (mode === "MOVIE") {
				const payload = NewMovieSchema.parse({
					title: value.title.trim(),
					year: Number(value.year),
					tmdb_id: value.tmdb_id,
					poster_url: value.poster_url,
					tmdb_rating: value.tmdb_rating,
					personal_rating: value.personal_rating,
					status: value.status,
					format: value.format,
					is_physical: value.is_physical ? 1 : 0,
					is_digital: value.is_digital ? 1 : 0,
					is_backed_up: 0,
					notes: value.notes.trim() || null,
					type: "MOVIE",
					show_id: null,
					season_number: null,
				});
				await createMovie(payload);
			} else {
				// TV mode — find or create TV_SHOW row, then create TV_SEASON row
				const n = Number(seasonNumber);
				if (!selectedShow || !n || n < 1) return;

				let showId: string;
				const existingShow = await getShowByTmdbId(selectedShow.id);
				if (existingShow) {
					showId = existingShow.id;
				} else {
					const showRow = await createMovie(
						NewMovieSchema.parse({
							title: selectedShow.name,
							year: selectedShow.first_air_date
								? Number(selectedShow.first_air_date.slice(0, 4))
								: null,
							tmdb_id: selectedShow.id,
							poster_url: showPosterUrl,
							tmdb_rating:
								selectedShow.vote_average > 0
									? selectedShow.vote_average
									: null,
							personal_rating: null,
							status: value.status,
							format: value.format,
							is_physical: 0,
							is_digital: 0,
							is_backed_up: 0,
							notes: null,
							type: "TV_SHOW",
							show_id: null,
							season_number: null,
						}),
					);
					showId = showRow.id;
				}

				const seasonPayload = NewMovieSchema.parse({
					title: `${selectedShow.name} — Season ${n}`,
					year: value.year ? Number(value.year) : null,
					tmdb_id: value.tmdb_id,
					poster_url: value.poster_url,
					tmdb_rating: value.tmdb_rating,
					personal_rating: value.personal_rating,
					status: value.status,
					format: value.format,
					is_physical: value.is_physical ? 1 : 0,
					is_digital: value.is_digital ? 1 : 0,
					is_backed_up: 0,
					notes: value.notes.trim() || null,
					type: "TV_SEASON",
					show_id: showId,
					season_number: n,
				});
				await createMovie(seasonPayload);
			}

			formApi.reset(value);
			navigate({ to: "/" });
		},
	});

	const blocker = useBlocker({
		shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitting,
		withResolver: true,
	});

	function switchMode(next: "MOVIE" | "TV") {
		if (next === mode) return;
		setMode(next);
		setTitleQuery("");
		setIsTitleFocused(false);
		setSelectedShow(null);
		setSeasonNumber("");
		setShowPosterUrl(null);
		form.reset();
	}

	async function handleSelectMovieResult(result: TmdbSearchResult) {
		setLoadingId(result.id);
		let posterUrl: string | null = null;
		if (result.poster_path) {
			try {
				posterUrl = await fetchAndCachePoster(result.id, result.poster_path);
			} catch {
				// poster unavailable — other fields still applied
			}
		}
		setLoadingId(null);
		form.setFieldValue("title", result.title);
		if (result.release_date) {
			form.setFieldValue("year", result.release_date.slice(0, 4));
		}
		form.setFieldValue("tmdb_id", result.id);
		form.setFieldValue(
			"tmdb_rating",
			result.vote_average > 0 ? result.vote_average : null,
		);
		if (posterUrl) form.setFieldValue("poster_url", posterUrl);
		setTitleQuery("");
		setIsTitleFocused(false);
	}

	async function handleSelectTvShow(result: TmdbTvSearchResult) {
		setLoadingId(result.id);
		let posterUrl: string | null = null;
		if (result.poster_path) {
			try {
				posterUrl = await fetchAndCachePoster(result.id, result.poster_path);
			} catch {
				// poster unavailable — other fields still applied
			}
		}
		setLoadingId(null);
		setSelectedShow(result);
		setShowPosterUrl(posterUrl);
		form.setFieldValue("title", result.name);
		if (result.first_air_date) {
			form.setFieldValue("year", result.first_air_date.slice(0, 4));
		}
		form.setFieldValue("tmdb_id", result.id);
		form.setFieldValue(
			"tmdb_rating",
			result.vote_average > 0 ? result.vote_average : null,
		);
		if (posterUrl) form.setFieldValue("poster_url", posterUrl);
		setTitleQuery("");
		setIsTitleFocused(false);
	}

	async function handleSeasonNumberBlur() {
		if (!selectedShow || !seasonNumber) return;
		const n = Number(seasonNumber);
		if (!n || n < 1) return;
		setIsFetchingSeasonPoster(true);
		try {
			const details = await fetchSeasonDetails(selectedShow.id, n);
			if (details.poster_path) {
				const posterUrl = await fetchAndCachePoster(
					details.id,
					details.poster_path,
				);
				form.setFieldValue("poster_url", posterUrl);
			}
		} catch {
			// leave poster as show-level poster
		}
		setIsFetchingSeasonPoster(false);
	}

	const titlePlaceholder = mode === "MOVIE" ? "Movie title" : "Show title";

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			{/* Header */}
			<div className="flex items-center gap-3 border-b border-white/10 p-4">
				<button
					type="button"
					className="text-blue-400"
					onClick={() => navigate({ to: "/" })}
				>
					Back
				</button>
				<h1 className="flex-1 text-center text-lg font-semibold">
					{mode === "MOVIE" ? "Add Movie" : "Add TV Show"}
				</h1>
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<button
							type="button"
							className="font-semibold text-blue-400 disabled:opacity-40"
							disabled={isSubmitting}
							onClick={form.handleSubmit}
						>
							{isSubmitting ? "Saving…" : "Add"}
						</button>
					)}
				</form.Subscribe>
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-5"
				>
					{/* Mode toggle */}
					<div className="flex gap-2">
						<button
							type="button"
							className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "MOVIE" ? "bg-blue-600 text-white" : "bg-white/5 text-white/50"}`}
							onClick={() => switchMode("MOVIE")}
						>
							Movie
						</button>
						<button
							type="button"
							className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "TV" ? "bg-blue-600 text-white" : "bg-white/5 text-white/50"}`}
							onClick={() => switchMode("TV")}
						>
							TV Show
						</button>
					</div>

					{/* Title with inline autocomplete */}
					<form.Field
						name="title"
						validators={{
							onBlur: ({ value }) => {
								const result = z
									.string()
									.min(1, "Title is required")
									.safeParse(value);
								return result.success
									? undefined
									: result.error.issues[0]?.message;
							},
						}}
					>
						{(field) => (
							<FormField
								label="Title *"
								error={field.state.meta.errors[0]?.toString()}
							>
								<div className="relative">
									<input
										value={field.state.value}
										placeholder={titlePlaceholder}
										className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
										onChange={(e) => {
											field.handleChange(e.target.value);
											setTitleQuery(e.target.value);
											// Clear selected show if user edits the title in TV mode
											if (mode === "TV") setSelectedShow(null);
										}}
										onFocus={() => setIsTitleFocused(true)}
										onBlur={() => {
											field.handleBlur();
											setTimeout(() => setIsTitleFocused(false), 150);
										}}
									/>
									{showDropdown && (
										<ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-gray-800 shadow-xl">
											{isSearching && (
												<li className="px-4 py-3 text-sm text-white/40">
													Searching…
												</li>
											)}
											{mode === "MOVIE" &&
												(movieResults ?? []).map((result) => {
													const year = result.release_date?.slice(0, 4);
													const isLoading = loadingId === result.id;
													return (
														<li key={result.id}>
															<button
																type="button"
																disabled={loadingId !== null}
																className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-white/5 disabled:opacity-50"
																onMouseDown={(e) => e.preventDefault()}
																onClick={() => handleSelectMovieResult(result)}
															>
																<div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/10">
																	{result.poster_path ? (
																		<img
																			src={`${TMDB_POSTER_BASE}${result.poster_path}`}
																			alt={result.title}
																			className="h-full w-full object-cover"
																		/>
																	) : (
																		<div className="h-full w-full" />
																	)}
																</div>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-medium text-white">
																		{result.title}
																	</p>
																	{year && (
																		<p className="text-xs text-white/50">
																			{year}
																		</p>
																	)}
																</div>
																{isLoading && (
																	<span className="text-xs text-white/40">
																		Loading…
																	</span>
																)}
															</button>
														</li>
													);
												})}
											{mode === "TV" &&
												(tvResults ?? []).map((result) => {
													const year = result.first_air_date?.slice(0, 4);
													const isLoading = loadingId === result.id;
													return (
														<li key={result.id}>
															<button
																type="button"
																disabled={loadingId !== null}
																className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-white/5 disabled:opacity-50"
																onMouseDown={(e) => e.preventDefault()}
																onClick={() => handleSelectTvShow(result)}
															>
																<div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/10">
																	{result.poster_path ? (
																		<img
																			src={`${TMDB_POSTER_BASE}${result.poster_path}`}
																			alt={result.name}
																			className="h-full w-full object-cover"
																		/>
																	) : (
																		<div className="h-full w-full" />
																	)}
																</div>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-medium text-white">
																		{result.name}
																	</p>
																	{year && (
																		<p className="text-xs text-white/50">
																			{year}
																		</p>
																	)}
																</div>
																{isLoading && (
																	<span className="text-xs text-white/40">
																		Loading…
																	</span>
																)}
															</button>
														</li>
													);
												})}
										</ul>
									)}
								</div>
							</FormField>
						)}
					</form.Field>

					{/* Season number — TV mode only, revealed after show selected */}
					{mode === "TV" && selectedShow && (
						<FormField label="Season Number">
							<input
								type="number"
								min={1}
								value={seasonNumber}
								placeholder="e.g. 1"
								className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
								onChange={(e) => setSeasonNumber(e.target.value)}
								onBlur={handleSeasonNumberBlur}
							/>
							{isFetchingSeasonPoster && (
								<p className="mt-1 text-xs text-white/40">
									Fetching season poster…
								</p>
							)}
						</FormField>
					)}

					{/* Year — hidden in TV mode (derived from first_air_date) */}
					{mode === "MOVIE" && (
						<form.Field name="year">
							{(field) => (
								<FormField label="Year">
									<Select
										options={YEAR_OPTIONS}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</FormField>
							)}
						</form.Field>
					)}

					{/* Poster + Physical/Digital */}
					<div className="flex gap-4">
						<form.Field name="poster_url">
							{(field) => (
								<PosterPicker
									value={field.state.value}
									onChange={(path) => field.handleChange(path)}
								/>
							)}
						</form.Field>
						<div className="flex flex-1 flex-col justify-center gap-4 rounded-lg border border-white/10 p-4">
							<form.Field name="is_physical">
								{(field) => (
									<Toggle
										checked={field.state.value}
										onChange={(v) => field.handleChange(v)}
										label="Physical copy"
										vertical
									/>
								)}
							</form.Field>
							<form.Field name="is_digital">
								{(field) => (
									<Toggle
										checked={field.state.value}
										onChange={(v) => field.handleChange(v)}
										label="Digital copy"
										vertical
									/>
								)}
							</form.Field>
						</div>
					</div>

					{/* Status */}
					<form.Field name="status">
						{(field) => (
							<FormField label="Status">
								<ToggleGroup
									options={STATUS_OPTIONS}
									value={field.state.value}
									onChange={(v) => field.handleChange(v)}
								/>
							</FormField>
						)}
					</form.Field>

					{/* Format */}
					<form.Field name="format">
						{(field) => (
							<FormField label="Format">
								<ToggleGroup
									options={FORMAT_OPTIONS}
									value={field.state.value}
									onChange={(v) => field.handleChange(v)}
								/>
							</FormField>
						)}
					</form.Field>

					{/* Personal Rating */}
					<form.Field name="personal_rating">
						{(field) => (
							<FormField label="Personal Rating">
								<div className="flex flex-col gap-3">
									<Toggle
										checked={field.state.value !== null}
										onChange={(enabled) =>
											field.handleChange(enabled ? 7 : null)
										}
										label="Rate this movie"
									/>
									{field.state.value !== null && (
										<Slider
											value={field.state.value}
											onChange={(v) => field.handleChange(v)}
										/>
									)}
								</div>
							</FormField>
						)}
					</form.Field>

					{/* TMDB Rating (read-only) */}
					<form.Subscribe selector={(s) => s.values.tmdb_rating}>
						{(tmdbRating) =>
							tmdbRating !== null ? (
								<FormField label="TMDB Rating">
									<p className="py-1 text-white/70">
										★{" "}
										{tmdbRating % 1 === 0 ? tmdbRating : tmdbRating.toFixed(1)}
									</p>
								</FormField>
							) : null
						}
					</form.Subscribe>

					{/* Notes */}
					<form.Field name="notes">
						{(field) => (
							<FormField label="Notes">
								<textarea
									value={field.state.value}
									placeholder="Optional notes…"
									rows={3}
									className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
							</FormField>
						)}
					</form.Field>
				</form>
			</div>

			<ConfirmSheet
				isOpen={blocker.status === "blocked"}
				title="Discard Changes"
				message="You have unsaved changes. Discard them?"
				confirmLabel="Discard"
				isDangerous
				onConfirm={() => blocker.proceed?.()}
				onCancel={() => blocker.reset?.()}
				secondaryLabel="Save & Continue"
				onSecondary={async () => {
					await form.handleSubmit();
					blocker.proceed?.();
				}}
			/>
		</div>
	);
}
