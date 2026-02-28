"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
}

export const useWatchlistStore = create<WatchlistState>()(
    persist(
        (set, get) => ({
            watchlist: [],

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
        }),
        {
            name: "anime-watchlist", // localStorage key
            storage: createJSONStorage(() => localStorage),
        }
    )
);
