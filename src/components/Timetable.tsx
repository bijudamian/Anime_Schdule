"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import CalendarHeader from "./CalendarHeader";
import AnimeCard from "./AnimeCard";
import FilterBar from "./FilterBar";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import type {
    TimetableShow,
    AnimeCardData,
    DaySchedule,
    FilterState,
} from "@/types/types";

// ─────────────────────────────────────────────────────────
// Timetable — main container that fetches data, organizes
// it into 7 day columns, and renders the weekly calendar.
// ─────────────────────────────────────────────────────────

const DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

/** CDN base URL for images */
const CDN_BASE = "https://img.animeschedule.net/production/assets/public/img/";

/** Convert a UTC ISO date string to the user's local time */
function formatLocalTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

/** Get the day-of-week index (0=Mon … 6=Sun) for a UTC ISO date in local time */
function getLocalDayIndex(isoString: string): number {
    const date = new Date(isoString);
    // JS getDay(): 0=Sun, 1=Mon, …, 6=Sat → convert to 0=Mon, 6=Sun
    const jsDay = date.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}

/** Get the Monday of the current week in local time */
function getWeekMonday(): Date {
    const now = new Date();
    const dayIndex = now.getDay(); // 0=Sun
    const diff = dayIndex === 0 ? -6 : 1 - dayIndex;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

/** Format a date as "23 Feb" */
function formatDateLabel(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Normalize a raw API show into our frontend card model */
function normalizeShow(show: TimetableShow): AnimeCardData {
    // airType is "sub", "dub", or "raw"
    const airTypeLower = (show.airType || "raw").toLowerCase();
    const releaseType: "SUB" | "DUB" | "RAW" =
        airTypeLower === "sub" ? "SUB" : airTypeLower === "dub" ? "DUB" : "RAW";

    // Extract primary media type from the mediaTypes array
    const primaryMediaType = show.mediaTypes?.[0]?.name || "TV";
    // Simplify: "ONA (Chinese)" → "ONA", "TV" → "TV"
    const mediaTypeSimple = primaryMediaType.split(" ")[0].toUpperCase();

    // Determine status from airingStatus field
    const airingStatus = (show.airingStatus || "").toLowerCase();
    const statusLower = (show.status || "").toLowerCase();
    // The API uses "0001-01-01T00:00:00Z" as the null datetime
    const hasValidDelayedFrom =
        !!show.delayedFrom && !show.delayedFrom.startsWith("0001");
    const isDelayed =
        airingStatus === "delayed-air" ||
        statusLower === "delayed" ||
        hasValidDelayedFrom;
    const isHiatus = statusLower.includes("hiatus");

    // Title fallback: english → title → romaji → fallback
    const title = show.english || show.title || show.romaji || "Unknown Title";

    return {
        id: show.route,
        title,
        episodeNumber: show.episodeNumber,
        imageUrl: show.imageVersionRoute || "",
        airTime: show.episodeDate,
        localTime: formatLocalTime(show.episodeDate),
        mediaType: mediaTypeSimple,
        releaseType,
        isDelayed,
        isHiatus,
        statusText: show.status,
        donghua: show.donghua ?? false,
        dayOfWeek: getLocalDayIndex(show.episodeDate),
    };
}

/** Build the 7-day schedule structure */
function buildWeekSchedule(shows: AnimeCardData[]): DaySchedule[] {
    const monday = getWeekMonday();
    const today = new Date();
    const todayIndex =
        today.getDay() === 0 ? 6 : today.getDay() - 1;

    return DAY_NAMES.map((name, idx) => {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + idx);

        // Filter shows for this day and sort by air time
        const dayShows = shows
            .filter((s) => s.dayOfWeek === idx)
            .sort(
                (a, b) =>
                    new Date(a.airTime).getTime() - new Date(b.airTime).getTime()
            );

        return {
            dayIndex: idx,
            dayName: name,
            dateLabel: formatDateLabel(dayDate),
            isToday: idx === todayIndex,
            shows: dayShows,
        };
    });
}

/** Fetch schedule from our secure API proxy */
async function fetchSchedule(): Promise<TimetableShow[]> {
    const res = await fetch("/api/schedule");
    if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    // The API may return an array directly or an object with items
    return Array.isArray(data) ? data : data.items || data.timetable || [];
}

export default function Timetable() {
    const { watchlist } = useWatchlistStore();

    const [filters, setFilters] = useState<FilterState>({
        showWatchlistOnly: false,
        noDonghua: false,
        tvOnly: false,
        onaOnly: false,
        subOnly: false,
        dubOnly: false,
    });

    const { data, isLoading, isError, error } = useQuery<TimetableShow[]>({
        queryKey: ["timetable"],
        queryFn: fetchSchedule,
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    const toggleFilter = (key: keyof FilterState) => {
        setFilters((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            // TV and ONA are mutually exclusive
            if (key === "tvOnly" && next.tvOnly) next.onaOnly = false;
            if (key === "onaOnly" && next.onaOnly) next.tvOnly = false;
            // SUB and DUB are mutually exclusive
            if (key === "subOnly" && next.subOnly) next.dubOnly = false;
            if (key === "dubOnly" && next.dubOnly) next.subOnly = false;
            return next;
        });
    };

    // Normalize, filter, and group shows
    const weekSchedule = useMemo(() => {
        if (!data) return buildWeekSchedule([]);

        let normalized = data.map(normalizeShow);

        // Apply filters
        if (filters.showWatchlistOnly) {
            normalized = normalized.filter((s) => watchlist.includes(s.id));
        }
        if (filters.noDonghua) {
            normalized = normalized.filter((s) => !s.donghua);
        }
        if (filters.tvOnly) {
            normalized = normalized.filter(
                (s) => s.mediaType.toUpperCase() === "TV"
            );
        }
        if (filters.onaOnly) {
            normalized = normalized.filter(
                (s) => s.mediaType.toUpperCase() === "ONA"
            );
        }
        if (filters.subOnly) {
            normalized = normalized.filter(
                (s) => s.releaseType === "SUB"
            );
        }
        if (filters.dubOnly) {
            normalized = normalized.filter(
                (s) => s.releaseType === "DUB"
            );
        }

        return buildWeekSchedule(normalized);
    }, [data, filters, watchlist]);

    return (
        <div className="min-h-screen" style={{ backgroundColor: "#2b2b2b" }}>
            {/* ── Filter Bar ── */}
            <FilterBar
                filters={filters}
                onToggleFilter={toggleFilter}
                watchlistCount={watchlist.length}
            />

            {/* ── Timezone Note ── */}
            <div className="flex justify-end px-4 py-1">
                <span className="text-[10px] italic text-gray-400">
                    *All times in your timezone
                </span>
            </div>

            {/* ── Calendar Header ── */}
            <CalendarHeader days={weekSchedule} />

            {/* ── Loading State ── */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                    <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
                    <p className="mt-4 text-sm">Loading anime schedule…</p>
                </div>
            )}

            {/* ── Error State ── */}
            {isError && (
                <div className="flex flex-col items-center justify-center py-32 text-red-400">
                    <AlertTriangle className="h-10 w-10" />
                    <p className="mt-4 text-sm">
                        Failed to load schedule:{" "}
                        {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        Check your API credentials in .env.local
                    </p>
                </div>
            )}

            {/* ── Timetable Grid (7 columns desktop, 1 column mobile) ── */}
            {!isLoading && !isError && (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-px" style={{ backgroundColor: "#333" }}>
                    {weekSchedule.map((day) => (
                        <div
                            key={day.dayIndex}
                            className={
                                day.isToday
                                    ? "grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 md:flex md:flex-col md:gap-px md:p-0"
                                    : "hidden md:flex md:flex-col md:gap-px md:p-0"
                            }
                            style={{
                                backgroundColor: day.isToday
                                    ? "rgba(58, 117, 196, 0.08)"
                                    : "#2b2b2b",
                            }}
                        >
                            {day.shows.length === 0 ? (
                                <div className="col-span-full flex min-h-[120px] items-center justify-center text-xs text-gray-600">
                                    No shows
                                </div>
                            ) : (
                                day.shows.map((anime, index) => (
                                    <AnimeCard key={`${anime.id}-${anime.airTime}-${anime.releaseType}-${index}`} anime={anime} />
                                ))
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Watchlist empty state ── */}
            {!isLoading &&
                !isError &&
                filters.showWatchlistOnly &&
                watchlist.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <p className="text-sm">Your watchlist is empty.</p>
                        <p className="mt-1 text-xs">
                            Hover over a show and click the bookmark icon to add it.
                        </p>
                    </div>
                )}
        </div>
    );
}
