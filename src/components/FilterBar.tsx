"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, List, X, EyeOff, RotateCcw, Save, Check, Trash2 } from "lucide-react";
import type { FilterState } from "@/types/types";
import { useWatchlistStore } from "@/store/useWatchlistStore";

import DownloadWatchlistButton from "./DownloadWatchlistButton";
import AuthButton from "./AuthButton";

// ─────────────────────────────────────────────────────────
// FilterBar — top toolbar with pill-shaped toggle buttons
//
// Layout: [Filters] [All Anime ↔ My Watchlist] | [No Donghua] [TV] [ONA] | [SUB] [DUB] | [Save Filters] | [Hidden (N)]
//         + Right Side: custom content (e.g. Week Navigation) + Auth
// ─────────────────────────────────────────────────────────

interface HiddenAnimeItem {
    id: string;
    title: string;
}

interface FilterBarProps {
    filters: FilterState;
    onToggleFilter: (key: keyof FilterState) => void;
    onSetFilters: (filters: FilterState) => void;
    watchlistCount: number;
    watchlistTitles: string[];
    rightContent?: React.ReactNode;
    hiddenAnimeData?: HiddenAnimeItem[];
    onUnhideAnime?: (id: string) => void;
    onClearHidden?: () => void;
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

/** Check if any non-default filter is active */
function hasActiveFilters(f: FilterState): boolean {
    return f.noDonghua || f.tvOnly || f.onaOnly || f.subOnly || f.dubOnly || f.showWatchlistOnly;
}

/** Check if two filter states are identical */
function filtersMatch(a: FilterState, b: FilterState): boolean {
    return (
        a.showWatchlistOnly === b.showWatchlistOnly &&
        a.noDonghua === b.noDonghua &&
        a.tvOnly === b.tvOnly &&
        a.onaOnly === b.onaOnly &&
        a.subOnly === b.subOnly &&
        a.dubOnly === b.dubOnly
    );
}

export default function FilterBar({
    filters,
    onToggleFilter,
    onSetFilters,
    watchlistCount,
    watchlistTitles,
    rightContent,
    hiddenAnimeData = [],
    onUnhideAnime,
    onClearHidden,
}: FilterBarProps) {
    const [hiddenDropdownOpen, setHiddenDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { savedFilters, saveFilters, clearSavedFilters } = useWatchlistStore();

    // Flash feedback when filters are saved
    const [justSaved, setJustSaved] = useState(false);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setHiddenDropdownOpen(false);
            }
        }
        if (hiddenDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [hiddenDropdownOpen]);

    const handleSaveFilters = () => {
        saveFilters(filters);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    const handleLoadSaved = () => {
        if (savedFilters) {
            onSetFilters(savedFilters);
        }
    };

    const handleClearSaved = () => {
        clearSavedFilters();
    };

    // Determine if current filters match saved
    const currentMatchesSaved = savedFilters ? filtersMatch(filters, savedFilters) : false;

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

                {/* ── Save / Load Filters ── */}
                <div className="mx-1 h-5 w-px bg-gray-600" />

                {/* Save button: only shown when filters differ from saved or no saved preset exists */}
                {hasActiveFilters(filters) && !currentMatchesSaved && (
                    <button
                        onClick={handleSaveFilters}
                        className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none cursor-pointer bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save Filters
                    </button>
                )}

                {/* Just-saved confirmation */}
                {justSaved && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-pulse">
                        <Check className="h-3.5 w-3.5" />
                        Saved!
                    </span>
                )}

                {/* Saved preset indicator + Load + Clear */}
                {savedFilters && !currentMatchesSaved && !justSaved && (
                    <button
                        onClick={handleLoadSaved}
                        className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none cursor-pointer bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/25"
                        title="Apply your saved filter preset"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Load Saved
                    </button>
                )}

                {/* Active saved indicator (when current matches saved) */}
                {currentMatchesSaved && (
                    <span className="inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="h-3 w-3" />
                        Saved Preset
                    </span>
                )}

                {/* Clear saved button */}
                {savedFilters && (
                    <button
                        onClick={handleClearSaved}
                        className="inline-flex items-center gap-1 rounded-sm p-1.5 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Clear saved filter preset"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                )}

                {/* ── Hidden Anime Bubble ── */}
                {hiddenAnimeData.length > 0 && (
                    <>
                        <div className="mx-1 h-5 w-px bg-gray-600" />
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setHiddenDropdownOpen(!hiddenDropdownOpen)}
                                className={`
                                    inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold
                                    transition-all duration-200 select-none cursor-pointer
                                    ${hiddenDropdownOpen
                                        ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                                        : "bg-pill-inactive text-gray-300 hover:bg-surface-light"
                                    }
                                `}
                            >
                                <EyeOff className="h-3.5 w-3.5" />
                                Hidden
                                <span className="ml-0.5 rounded-full bg-red-500/30 px-1.5 py-0.5 text-[10px] text-red-300">
                                    {hiddenAnimeData.length}
                                </span>
                            </button>

                            {/* Dropdown list */}
                            {hiddenDropdownOpen && (
                                <div
                                    className="absolute top-full left-0 mt-2 z-50 w-72 max-h-80 overflow-y-auto rounded-md border border-gray-600 shadow-xl"
                                    style={{ backgroundColor: "#2a2a2a" }}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-600">
                                        <span className="text-xs font-semibold text-gray-300">
                                            Hidden Anime ({hiddenAnimeData.length})
                                        </span>
                                        {onClearHidden && (
                                            <button
                                                onClick={() => {
                                                    onClearHidden();
                                                    setHiddenDropdownOpen(false);
                                                }}
                                                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Unhide All
                                            </button>
                                        )}
                                    </div>

                                    {/* List */}
                                    <div className="py-1">
                                        {hiddenAnimeData.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                            >
                                                <span className="text-xs text-gray-300 truncate mr-2 flex-1">
                                                    {item.title}
                                                </span>
                                                {onUnhideAnime && (
                                                    <button
                                                        onClick={() => onUnhideAnime(item.id)}
                                                        className="shrink-0 text-[10px] font-semibold text-brand-blue hover:text-white px-2 py-0.5 rounded bg-brand-blue/10 hover:bg-brand-blue/30 transition-colors"
                                                    >
                                                        Show
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── Right Side: Custom Content + Auth ── */}
            <div className="flex items-center gap-3 ml-auto">
                {rightContent}
                <div className="mx-1 h-5 w-px bg-gray-600" />
                <AuthButton />
            </div>
        </div>
    );
}
