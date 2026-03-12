import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Film, Plus, RefreshCw, Settings } from "lucide-react";
import { cn } from "../../../lib/cn";

// Typed to valid top-level nav routes — adding a new tab means adding
// one entry here. If this grows beyond 4-5, consider a "More" menu.
type NavRoute = "/" | "/movie/add" | "/sync" | "/settings";

interface NavItem {
	label: string;
	icon: LucideIcon;
	to: NavRoute;
}

const NAV_ITEMS: NavItem[] = [
	{ label: "Collection", icon: Film, to: "/" },
	{ label: "Add Media", icon: Plus, to: "/movie/add" },
	{ label: "Sync", icon: RefreshCw, to: "/sync" },
	{ label: "Settings", icon: Settings, to: "/settings" },
];

export function NavBar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const navigate = useNavigate();

	return (
		<nav
			className="flex shrink-0 border-t border-white/10 bg-gray-900"
			style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
		>
			{NAV_ITEMS.map(({ label, icon: Icon, to }) => {
				const isActive = pathname === to;
				return (
					<button
						key={to}
						type="button"
						className={cn(
							"flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors",
							isActive ? "text-white" : "text-white/40",
						)}
						onClick={() => navigate({ to })}
					>
						<Icon size={22} />
						<span className="text-xs font-medium">{label}</span>
					</button>
				);
			})}
		</nav>
	);
}
