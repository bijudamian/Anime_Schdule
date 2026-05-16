"use client";

// ─────────────────────────────────────────────────────────
// SyncProvider — bridges Clerk auth ↔ Zustand store ↔ MongoDB
//
// When a user signs in:
//   1. Fetches their preferences from the API
//   2. Merges DB data with any local data (union strategy)
//   3. Pushes the merged result back to the DB
//
// On every store change (debounced):
//   → Saves to MongoDB via the API
//
// When user signs out:
//   → Local data persists in localStorage but stops syncing
// ─────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useWatchlistStore } from "@/store/useWatchlistStore";

/** Debounce timer in milliseconds */
const SYNC_DEBOUNCE_MS = 1500;

export default function SyncProvider({ children }: { children: React.ReactNode }) {
    const { isSignedIn, isLoaded } = useUser();
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasSyncedRef = useRef(false);
    const isSavingRef = useRef(false);

    // ── Save current store to the API ──
    const saveToApi = useCallback(async () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        try {
            const { watchlist, hiddenAnime, savedFilters } = useWatchlistStore.getState();
            await fetch("/api/user-preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ watchlist, hiddenAnime, savedFilters }),
            });
        } catch (err) {
            console.error("[SyncProvider] Failed to save:", err);
        } finally {
            isSavingRef.current = false;
        }
    }, []);

    // ── Debounced save on store changes ──
    const debouncedSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveToApi();
        }, SYNC_DEBOUNCE_MS);
    }, [saveToApi]);

    // ── Load from DB on sign-in (runs once per sign-in) ──
    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            hasSyncedRef.current = false;
            return;
        }
        if (hasSyncedRef.current) return;

        hasSyncedRef.current = true;

        (async () => {
            try {
                const res = await fetch("/api/user-preferences");
                if (!res.ok) return;

                const dbData = await res.json();
                const local = useWatchlistStore.getState();

                // Merge strategy: union of local + DB, keeping unique entries
                const mergedWatchlist = Array.from(
                    new Set([...(dbData.watchlist || []), ...local.watchlist])
                );
                const mergedHidden = Array.from(
                    new Set([...(dbData.hiddenAnime || []), ...local.hiddenAnime])
                );

                // For savedFilters: DB wins if it exists, otherwise keep local
                const mergedSavedFilters = dbData.savedFilters ?? local.savedFilters;

                // Update the store with merged data
                useWatchlistStore.setState({
                    watchlist: mergedWatchlist,
                    hiddenAnime: mergedHidden,
                    savedFilters: mergedSavedFilters,
                });

                // Push merged result back to the DB
                await fetch("/api/user-preferences", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        watchlist: mergedWatchlist,
                        hiddenAnime: mergedHidden,
                        savedFilters: mergedSavedFilters,
                    }),
                });
            } catch (err) {
                console.error("[SyncProvider] Failed to load from DB:", err);
            }
        })();
    }, [isLoaded, isSignedIn]);

    // ── Subscribe to store changes and auto-save (only when signed in) ──
    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        const unsubscribe = useWatchlistStore.subscribe(() => {
            debouncedSave();
        });

        return () => {
            unsubscribe();
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [isLoaded, isSignedIn, debouncedSave]);

    return <>{children}</>;
}
