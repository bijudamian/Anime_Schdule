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
// Stale cleanup:
//   → After sync, prunes watchlist IDs not in the current
//     schedule to prevent old seasons from piling up
//
// When user signs out:
//   → Local data persists in localStorage but stops syncing
// ─────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useWatchlistStore } from "@/store/useWatchlistStore";

/** Debounce timer in milliseconds */
const SYNC_DEBOUNCE_MS = 1500;

export default function SyncProvider({ children }: { children: React.ReactNode }) {
    const { isSignedIn, isLoaded } = useUser();
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasSyncedRef = useRef(false);
    const isSavingRef = useRef(false);

    // ── Fetch current schedule data for stale-cleanup ──
    const { data: scheduleData } = useQuery({
        queryKey: ["schedule-for-cleanup"],
        queryFn: async () => {
            const res = await fetch("/api/schedule");
            if (!res.ok) return null;
            return res.json();
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
    });

    // ── Save current store to the API ──
    const saveToApi = useCallback(async () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        try {
            const { watchlist, actuallyWatching, hiddenAnime, savedFilterPresets } = useWatchlistStore.getState();
            await fetch("/api/user-preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    watchlist,
                    actuallyWatching,
                    hiddenAnime,
                    savedFilterPresets,
                }),
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
                const mergedActuallyWatching = Array.from(
                    new Set([...(dbData.actuallyWatching || []), ...local.actuallyWatching])
                );
                const mergedHidden = Array.from(
                    new Set([...(dbData.hiddenAnime || []), ...local.hiddenAnime])
                );

                // For savedFilterPresets: DB wins per-slot if it exists, otherwise keep local
                const dbPresets = dbData.savedFilterPresets ?? [null, null];
                const mergedPresets = [
                    dbPresets[0] ?? local.savedFilterPresets[0],
                    dbPresets[1] ?? local.savedFilterPresets[1],
                ];

                // Update the store with merged data
                useWatchlistStore.setState({
                    watchlist: mergedWatchlist,
                    actuallyWatching: mergedActuallyWatching,
                    hiddenAnime: mergedHidden,
                    savedFilterPresets: mergedPresets as [typeof mergedPresets[0], typeof mergedPresets[1]],
                });

                // Push merged result back to the DB
                await fetch("/api/user-preferences", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        watchlist: mergedWatchlist,
                        actuallyWatching: mergedActuallyWatching,
                        hiddenAnime: mergedHidden,
                        savedFilterPresets: mergedPresets,
                    }),
                });
            } catch (err) {
                console.error("[SyncProvider] Failed to load from DB:", err);
            }
        })();
    }, [isLoaded, isSignedIn]);

    // ── Auto-cleanup stale watchlist entries ──
    // After schedule data loads, remove watchlist IDs not in the current schedule
    useEffect(() => {
        if (!scheduleData || !isLoaded || !isSignedIn) return;

        // Extract all anime route IDs from the current schedule
        // The schedule API returns TimetableShow[] where each has a `route` slug
        const currentIds = new Set<string>();

        const shows = Array.isArray(scheduleData) ? scheduleData : [];

        for (const show of shows) {
            if (show?.route) currentIds.add(show.route);
        }

        if (currentIds.size === 0) return; // Don't prune if schedule failed

        const { watchlist, actuallyWatching } = useWatchlistStore.getState();

        // Only clean up if there are stale entries
        const cleanedWatchlist = watchlist.filter((id) => currentIds.has(id));
        const cleanedActuallyWatching = actuallyWatching.filter((id) => currentIds.has(id));

        const removedCount = watchlist.length - cleanedWatchlist.length;
        const removedWatchingCount = actuallyWatching.length - cleanedActuallyWatching.length;

        if (removedCount > 0 || removedWatchingCount > 0) {
            console.log(
                `[SyncProvider] Cleaned up ${removedCount} stale watchlist entries ` +
                `and ${removedWatchingCount} stale actually-watching entries`
            );
            useWatchlistStore.setState({
                watchlist: cleanedWatchlist,
                actuallyWatching: cleanedActuallyWatching,
            });
        }
    }, [scheduleData, isLoaded, isSignedIn]);

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
