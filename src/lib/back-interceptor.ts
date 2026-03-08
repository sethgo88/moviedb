/**
 * Module-level back interceptor for the Android hardware back button.
 *
 * Components that own dirty forms (e.g. MovieForm) register a handler that
 * shows a discard confirmation and returns true (consumed). The
 * useAndroidBackButton hook calls tryInterceptBack() before navigating —
 * if true, the navigation is suppressed.
 *
 * Only one interceptor is active at a time (the most recently registered one).
 */

let interceptor: (() => boolean) | null = null;

export function registerBackInterceptor(fn: () => boolean): void {
	interceptor = fn;
}

export function unregisterBackInterceptor(): void {
	interceptor = null;
}

/** Returns true if the back action was consumed by an interceptor. */
export function tryInterceptBack(): boolean {
	return interceptor?.() ?? false;
}
