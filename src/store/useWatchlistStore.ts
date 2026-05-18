"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FilterState } from "@/types/types";

// ─────────────────────────────────────────────────────────
// Zustand store for the user's anime watchlist.
// Persisted to localStorage so it survives page reloads.
// ─────────────────────────────────────────────────────────

/** Two preset slots for saved filters */
type FilterPresets = [FilterState | null, FilterState | null];

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

    /** @deprecated Kept for migration — use savedFilterPresets instead */
    savedFilters: FilterState | null;

    /** Two preset slots for saved filter configurations */
    savedFilterPresets: FilterPresets;

    /** Save the current filter state into a preset slot (0 or 1) */
    saveFilterPreset: (slot: number, filters: FilterState) => void;

    /** Clear a specific preset slot */
    clearFilterPreset: (slot: number) => void;

    /** Legacy: Save filters (writes to slot 0 for compat) */
    saveFilters: (filters: FilterState) => void;

    /** Legacy: Clear saved filters (clears slot 0 for compat) */
    clearSavedFilters: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
    persist(
        (set, get) => ({
            watchlist: [],
            hiddenAnime: [],
            savedFilters: null,
            savedFilterPresets: [null, null] as FilterPresets,

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

            saveFilterPreset: (slot: number, filters: FilterState) => {
                const presets = [...get().savedFilterPresets] as FilterPresets;
                presets[slot] = filters;
                set({ savedFilterPresets: presets });
            },

            clearFilterPreset: (slot: number) => {
                const presets = [...get().savedFilterPresets] as FilterPresets;
                presets[slot] = null;
                set({ savedFilterPresets: presets });
            },

            // Legacy compat
            saveFilters: (filters: FilterState) => {
                const presets = [...get().savedFilterPresets] as FilterPresets;
                presets[0] = filters;
                set({ savedFilters: filters, savedFilterPresets: presets });
            },

            clearSavedFilters: () => {
                const presets = [...get().savedFilterPresets] as FilterPresets;
                presets[0] = null;
                set({ savedFilters: null, savedFilterPresets: presets });
            },
        }),
        {
            name: "anime-watchlist", // localStorage key
            storage: createJSONStorage(() => localStorage),
            version: 1,
            migrate: (persisted: unknown, version: number) => {
                const state = persisted as Record<string, unknown>;
                if (version === 0 || !state.savedFilterPresets) {
                    // Migrate old single savedFilters into slot 0
                    const legacy = state.savedFilters as FilterState | null;
                    state.savedFilterPresets = [legacy || null, null];
                }
                return state as unknown as WatchlistState;
            },
        }
    )
);
