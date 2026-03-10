import { useForm } from "@tanstack/react-form";
import { useBlocker, useNavigate, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import {
	useMovie,
	useSoftDeleteMovie,
} from "../../../features/movies/movies.queries";
import type {
	MovieFormat,
	MovieStatus,
} from "../../../features/movies/movies.types";
import type { TmdbSearchResult } from "../../../features/tmdb/tmdb.types";
import { PosterPicker } from "../../atoms/PosterPicker/poster-picker";
import { Select } from "../../atoms/Select/select";
import { Slider } from "../../atoms/Slider/slider";
import { Spinner } from "../../atoms/Spinner/spinner";
import { Toast } from "../../atoms/Toast/toast";
import { Toggle } from "../../atoms/Toggle/toggle";
import { ConfirmSheet } from "../../molecules/ConfirmSheet/confirm-sheet";
import { FormField } from "../../molecules/FormField/form-field";
import { TmdbSearch } from "../../molecules/TmdbSearch/tmdb-search";
import { ToggleGroup } from "../../molecules/ToggleGroup/toggle-group";

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

export interface MovieFormValues {
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

interface MovieFormProps {
	title: string;
	submitLabel: string;
	initialValues?: Partial<MovieFormValues>;
	onCancel: () => void;
	onSubmit: (values: MovieFormValues) => Promise<void>;
}

const DEFAULTS: MovieFormValues = {
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

export function MovieForm({
	title,
	submitLabel,
	initialValues,
	onCancel,
	onSubmit,
}: MovieFormProps) {
	const navigate = useNavigate();
	const { id } = useParams({ strict: false });
	const form = useForm({
		defaultValues: { ...DEFAULTS, ...initialValues },
		onSubmit: async ({ value, formApi }) => {
			await onSubmit(value);
			formApi.reset(value);
		},
	});

	const { data: movie, isLoading } = useMovie(id);
	const { mutate: softDelete, isPending: isDeleting } = useSoftDeleteMovie();
	const [showDelete, setShowDelete] = useState(false);
	const [showTmdbSearch, setShowTmdbSearch] = useState(false);
	const [tmdbToast, setTmdbToast] = useState<{
		message: string;
		variant: "success" | "error";
	} | null>(null);

	// Router-level blocker — intercepts all navigation (NavBar, back gesture,
	// programmatic navigate) when the form is dirty.
	// Exclude isSubmitting: navigation triggered inside onSubmit (e.g. navigate
	// after createMovie/updateMovie) must not be blocked — formApi.reset() hasn't
	// run yet so isDirty is still true at that moment.
	const blocker = useBlocker({
		shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitting,
		withResolver: true,
	});

	if (submitLabel === "Save") {
		if (isLoading) return <Spinner />;
		if (!movie) {
			return (
				<div className="flex h-full items-center justify-center bg-gray-950 text-white/50">
					Movie not found.
				</div>
			);
		}
	}

	function handleDelete() {
		if (!movie) return;
		softDelete(movie.id, {
			onSuccess: () => navigate({ to: "/" }),
		});
	}

	function handleTmdbSelect(result: TmdbSearchResult, url: string | null) {
		form.setFieldValue("title", result.title);
		if (result.release_date) {
			form.setFieldValue("year", result.release_date.slice(0, 4));
		}
		form.setFieldValue("tmdb_id", result.id);
		form.setFieldValue(
			"tmdb_rating",
			result.vote_average > 0 ? result.vote_average : null,
		);
		if (url) {
			form.setFieldValue("poster_url", url);
		}
		setShowTmdbSearch(false);
		setTmdbToast({ message: "TMDB data applied", variant: "success" });
		setTimeout(() => setTmdbToast(null), 3000);
	}

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			{/* Header */}
			<div className="flex items-center gap-3 border-b border-white/10 p-4">
				<button type="button" className="text-blue-400" onClick={onCancel}>
					Back
				</button>
				<h1 className="flex-1 text-center text-lg font-semibold">{title}</h1>
				<button
					type="button"
					aria-label="Search TMDB"
					className="mr-2 text-white/50"
					onClick={() => setShowTmdbSearch(true)}
				>
					<Search size={20} />
				</button>
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<button
							type="button"
							className="font-semibold text-blue-400 disabled:opacity-40"
							disabled={isSubmitting}
							onClick={form.handleSubmit}
						>
							{isSubmitting ? "Saving…" : submitLabel}
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
					{/* Poster + Title/Year row */}
					<div className="flex gap-4">
						<form.Field name="poster_url">
							{(field) => (
								<PosterPicker
									value={field.state.value}
									onChange={(path) => field.handleChange(path)}
								/>
							)}
						</form.Field>

						<div className="flex flex-1 flex-col gap-3">
							{/* Title */}
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
										<input
											value={field.state.value}
											placeholder="Movie title"
											className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
									</FormField>
								)}
							</form.Field>

							{/* Year */}
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

					{/* Copy type toggles */}
					<div className="flex justify-around gap-4 rounded-lg border border-white/10 p-4">
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
				{movie && (
					<div>
						{/* Delete */}
						<div className="border-t border-white/10 p-4">
							<button
								type="button"
								className="min-h-12 w-full rounded-lg font-semibold text-red-500 transition-opacity active:opacity-70 disabled:opacity-40"
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
				)}
			</div>

			<Toast
				message={tmdbToast?.message ?? ""}
				visible={tmdbToast !== null}
				variant={tmdbToast?.variant}
			/>

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

			<TmdbSearch
				isOpen={showTmdbSearch}
				onClose={() => setShowTmdbSearch(false)}
				onSelect={handleTmdbSelect}
			/>
		</div>
	);
}
