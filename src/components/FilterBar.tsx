"use client";

import { Filter, List, X } from "lucide-react";
import type { FilterState } from "@/types/types";

import DownloadWatchlistButton from "./DownloadWatchlistButton";

// ─────────────────────────────────────────────────────────
// FilterBar — top toolbar with pill-shaped toggle buttons
//
// Layout: [Filters] [Anime List Always Visible] [No Donghua] [TV] [ONA]
//         + Primary: [All Anime ↔ My Watchlist]
// ─────────────────────────────────────────────────────────

interface FilterBarProps {
    filters: FilterState;
    onToggleFilter: (key: keyof FilterState) => void;
    watchlistCount: number;
    watchlistTitles: string[];
    rightContent?: React.ReactNode;
}

function PillButton({
    active,
    onClick,
    children,
    primary = false,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    primary?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`
        inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold
        transition-all duration-200 select-none cursor-pointer
        ${active
                    ? primary
                        ? "bg-brand-blue text-white shadow-md shadow-brand-blue/30"
                        : "bg-brand-blue text-white"
                    : "bg-pill-inactive text-gray-300 hover:bg-surface-light"
                }
      `}
        >
            {children}
        </button>
    );
}

export default function FilterBar({
    filters,
    onToggleFilter,
    watchlistCount,
    watchlistTitles,
    rightContent,
}: FilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3"
            style={{ backgroundColor: "#333" }}>

            {/* ── Left Side: Filters ── */}
            <div className="flex flex-wrap items-center gap-2 flex-grow">
                {/* Filters label */}
                <div className="mr-1 flex items-center gap-1 text-xs text-gray-400">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filters</span>
                </div>

                {/* All Anime / My Watchlist toggle */}
                <PillButton
                    active={!filters.showWatchlistOnly}
                    onClick={() => {
                        if (filters.showWatchlistOnly) onToggleFilter("showWatchlistOnly");
                    }}
                    primary
                >
                    <List className="h-3.5 w-3.5" />
                    All Anime
                </PillButton>

                <PillButton
                    active={filters.showWatchlistOnly}
                    onClick={() => {
                        if (!filters.showWatchlistOnly) onToggleFilter("showWatchlistOnly");
                    }}
                    primary
                >
                    My Watchlist
                    {watchlistCount > 0 && (
                        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                            {watchlistCount}
                        </span>
                    )}
                </PillButton>

                {/* Separator */}
                <div className="mx-1 h-5 w-px bg-gray-600" />


                {/* No Donghua */}
                <PillButton
                    active={filters.noDonghua}
                    onClick={() => onToggleFilter("noDonghua")}
                >
                    {filters.noDonghua && <X className="h-3 w-3" />}
                    No Donghua
                </PillButton>

                {/* TV */}
                <PillButton
                    active={filters.tvOnly}
                    onClick={() => onToggleFilter("tvOnly")}
                >
                    TV
                </PillButton>

                {/* ONA */}
                <PillButton
                    active={filters.onaOnly}
                    onClick={() => onToggleFilter("onaOnly")}
                >
                    ONA
                </PillButton>

                {/* Separator */}
                <div className="mx-1 h-5 w-px bg-gray-600" />

                {/* SUB */}
                <PillButton
                    active={filters.subOnly}
                    onClick={() => onToggleFilter("subOnly")}
                >
                    SUB
                </PillButton>

                {/* DUB */}
                <PillButton
                    active={filters.dubOnly}
                    onClick={() => onToggleFilter("dubOnly")}
                >
                    DUB
                </PillButton>
            </div>

            {/* ── Right Side: Custom Content (e.g. Week Navigation) ── */}
            {rightContent && (
                <div className="flex items-center ml-auto">
                    {rightContent}
                </div>
            )}
        </div>
    );
}
