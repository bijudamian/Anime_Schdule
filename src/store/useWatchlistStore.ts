"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FilterState } from "@/types/types";

// ─────────────────────────────────────────────────────────
// Zustand store for the user's anime watchlist.
// Persisted to localStorage so it survives page reloads.
// ─────────────────────────────────────────────────────────

interface WatchlistState {
    /** Array of anime route IDs the user is watching */
    watchlist: string[];

    /** Toggle an anime in/out of the watchlist */
    toggleAnime: (id: string) => void;

    /** Check if an anime is in the watchlist */
    isWatching: (id: string) => boolean;

    /** Clear the entire watchlist */
    clearAll: () => void;

    /** Array of anime route IDs the user has hidden from the dashboard */
    hiddenAnime: string[];

    /** Toggle an anime in/out of the hidden list */
    toggleHidden: (id: string) => void;

    /** Check if an anime is hidden */
    isHidden: (id: string) => boolean;

    /** Unhide a specific anime */
    unhideAnime: (id: string) => void;

    /** Clear all hidden anime */
    clearHidden: () => void;

    /** Saved filter preset — auto-applied on page load */
    savedFilters: FilterState | null;

    /** Save the current filter state as a preset */
    saveFilters: (filters: FilterState) => void;

    /** Clear the saved filter preset */
    clearSavedFilters: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
    persist(
        (set, get) => ({
            watchlist: [],
            hiddenAnime: [],
            savedFilters: null,

            toggleAnime: (id: string) => {
                const current = get().watchlist;
                if (current.includes(id)) {
                    set({ watchlist: current.filter((item) => item !== id) });
                } else {
                    set({ watchlist: [...current, id] });
                }
            },

            isWatching: (id: string) => {
                return get().watchlist.includes(id);
            },

            clearAll: () => {
                set({ watchlist: [] });
            },

            toggleHidden: (id: string) => {
                const current = get().hiddenAnime;
                if (current.includes(id)) {
                    set({ hiddenAnime: current.filter((item) => item !== id) });
                } else {
                    set({ hiddenAnime: [...current, id] });
                }
            },

            isHidden: (id: string) => {
                return get().hiddenAnime.includes(id);
            },

            unhideAnime: (id: string) => {
                set({ hiddenAnime: get().hiddenAnime.filter((item) => item !== id) });
            },

            clearHidden: () => {
                set({ hiddenAnime: [] });
            },

            saveFilters: (filters: FilterState) => {
                set({ savedFilters: filters });
            },

            clearSavedFilters: () => {
                set({ savedFilters: null });
            },
        }),
        {
            name: "anime-watchlist", // localStorage key
            storage: createJSONStorage(() => localStorage),
        }
    )
);
