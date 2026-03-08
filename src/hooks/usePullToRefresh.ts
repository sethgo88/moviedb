import { useCallback, useRef, useState } from "react";

const THRESHOLD = 64; // px to pull before triggering refresh
const MAX_PULL = 80; // px cap on visual pull distance

interface UsePullToRefreshOptions {
	onRefresh: () => Promise<void>;
}

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions) {
	const containerRef = useRef<HTMLDivElement>(null);
	const startY = useRef(0);
	const [pullDistance, setPullDistance] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const pulling = useRef(false);

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		const el = containerRef.current;
		if (!el || el.scrollTop > 0) return;
		startY.current = e.touches[0]?.clientY ?? 0;
		pulling.current = true;
	}, []);

	const onTouchMove = useCallback((e: React.TouchEvent) => {
		if (!pulling.current) return;
		const el = containerRef.current;
		if (!el || el.scrollTop > 0) {
			pulling.current = false;
			setPullDistance(0);
			return;
		}
		const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
		if (dy <= 0) {
			setPullDistance(0);
			return;
		}
		// Apply rubber-band easing
		setPullDistance(Math.min(MAX_PULL, dy * 0.5));
	}, []);

	const onTouchEnd = useCallback(async () => {
		if (!pulling.current) return;
		pulling.current = false;
		if (pullDistance >= THRESHOLD * 0.5) {
			setIsRefreshing(true);
			setPullDistance(0);
			try {
				await onRefresh();
			} finally {
				setIsRefreshing(false);
			}
		} else {
			setPullDistance(0);
		}
	}, [pullDistance, onRefresh]);

	return {
		containerRef,
		pullDistance,
		isRefreshing,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
	};
}
