"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import CalendarHeader from "./CalendarHeader";
import AnimeCard from "./AnimeCard";
import FilterBar from "./FilterBar";
import NowIndicator from "./NowIndicator";
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
function getWeekMonday(now: Date = new Date()): Date {
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
        romaji: show.romaji,
        english: show.english,
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
function buildWeekSchedule(shows: AnimeCardData[], now: Date = new Date(), weekOffset: number = 0, selectedDayIndex: number = -1): DaySchedule[] {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const monday = getWeekMonday(targetDate);

    const todayIndex =
        now.getDay() === 0 ? 6 : now.getDay() - 1;

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
            isToday: weekOffset === 0 && idx === todayIndex,
            isSelected: idx === selectedDayIndex,
            shows: dayShows,
        };
    });
}

/** Calculate ISO Year and Week for a given date */
function getISOWeekInfo(date: Date) {
    const target = new Date(date.valueOf());
    const dayNr = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return {
        year: target.getFullYear(),
        week: 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
    };
}

/** Fetch schedule from our secure API proxy */
async function fetchSchedule(weekOffset: number): Promise<TimetableShow[]> {
    let url = "/api/schedule";
    if (weekOffset !== 0) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + weekOffset * 7);
        const { year, week } = getISOWeekInfo(targetDate);
        url += `?year=${year}&week=${week}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    // The API may return an array directly or an object with items
    return Array.isArray(data) ? data : data.items || data.timetable || [];
}

export default function Timetable() {
    const { watchlist, hiddenAnime, unhideAnime, clearHidden, savedFilterPresets } = useWatchlistStore();

    // Use state to force the client date to hydrate perfectly and roll over at midnight
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const interval = setInterval(() => setCurrentTime(new Date()), 60 * 1000); // 1min for now-indicator sync
        return () => clearInterval(interval);
    }, []);

    const [filters, setFilters] = useState<FilterState>({
        showWatchlistOnly: false,
        noDonghua: false,
        tvOnly: false,
        onaOnly: false,
        subOnly: false,
        dubOnly: false,
    });

    // Auto-apply first saved filter preset on mount
    const [hasLoadedSaved, setHasLoadedSaved] = useState(false);
    useEffect(() => {
        if (!hasLoadedSaved) {
            // Apply the first non-null preset
            const preset = savedFilterPresets[0] ?? savedFilterPresets[1];
            if (preset) {
                setFilters(preset);
            }
            setHasLoadedSaved(true);
        }
    }, [savedFilterPresets, hasLoadedSaved]);

    const [dayOffset, setDayOffset] = useState(0);

    const now = currentTime || new Date();
    const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const absoluteDayIndex = todayIndex + dayOffset;
    const weekOffset = Math.floor(absoluteDayIndex / 7);
    const selectedDayIndex = ((absoluteDayIndex % 7) + 7) % 7;

    const { data, isLoading, isError, error, isFetching } = useQuery<TimetableShow[]>({
        queryKey: ["timetable", weekOffset],
        queryFn: () => fetchSchedule(weekOffset),
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

    // Calculate titles for items in the user's watchlist
    const watchlistTitles = useMemo(() => {
        if (!data) return [];
        const set = new Set<string>();
        data.forEach((show) => {
            if (watchlist.includes(show.route)) {
                const title = show.english || show.title || show.romaji;
                if (title) set.add(title);
            }
        });
        return Array.from(set);
    }, [data, watchlist]);

    // Used for torrent uniqueness calculations
    const allRomajiTitles = useMemo(() => {
        if (!data) return [];
        return data.map((s) => s.romaji || s.title || "").filter(Boolean);
    }, [data]);

    // Normalize, filter, and group shows
    const weekSchedule = useMemo(() => {
        const now = currentTime || new Date();

        if (!data) return buildWeekSchedule([], now);

        let normalized = data.map(normalizeShow);

        // Filter out hidden anime
        normalized = normalized.filter((s) => !hiddenAnime.includes(s.id));

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

        return buildWeekSchedule(normalized, now, weekOffset, selectedDayIndex);
    }, [data, filters, watchlist, hiddenAnime, currentTime, weekOffset, selectedDayIndex]);

    // Build a deduplicated list of hidden anime with titles for the FilterBar bubble
    // Groups multiple route IDs (e.g. SUB + DUB) under a single title
    const hiddenAnimeData = useMemo(() => {
        if (!data) return [];
        const titleMap = new Map<string, { ids: string[]; title: string }>();
        data
            .filter((s) => hiddenAnime.includes(s.route))
            .forEach((s) => {
                const title = s.english || s.title || s.romaji || "Unknown";
                const existing = titleMap.get(title);
                if (existing) {
                    existing.ids.push(s.route);
                } else {
                    titleMap.set(title, { ids: [s.route], title });
                }
            });
        return Array.from(titleMap.values()).map((entry) => ({
            id: entry.ids[0], // primary ID for keying
            ids: entry.ids,   // all route IDs for this title
            title: entry.title,
        }));
    }, [data, hiddenAnime]);

    // Unhide all route IDs associated with a grouped title entry
    const handleUnhideGroup = (ids: string[]) => {
        ids.forEach((id) => unhideAnime(id));
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: "#2b2b2b" }}>
            {/* ── Filter Bar ── */}
            <FilterBar
                filters={filters}
                onToggleFilter={toggleFilter}
                onSetFilters={(f) => setFilters(f)}
                watchlistCount={watchlist.length}
                watchlistTitles={watchlistTitles}
                hiddenAnimeData={hiddenAnimeData}
                onUnhideAnime={(id) => {
                    // Find the group this ID belongs to and unhide all in the group
                    const group = hiddenAnimeData.find((g) => g.id === id);
                    if (group) {
                        handleUnhideGroup(group.ids);
                    } else {
                        unhideAnime(id);
                    }
                }}
                onClearHidden={clearHidden}
                rightContent={
                    <div className="hidden sm:flex items-center gap-3">
                        <button
                            onClick={() => setDayOffset(prev => prev - 7)}
                            className="text-[11px] font-semibold px-2 py-1.5 rounded bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 transition-colors"
                        >
                            &larr; Prev Week
                        </button>
                        <span className="text-sm font-semibold text-gray-200 min-w-[100px] text-center">
                            {weekOffset === 0 ? "Current Week" : weekOffset < 0 ? `${Math.abs(weekOffset)} Week${weekOffset === -1 ? '' : 's'} Ago` : `${weekOffset} Week${weekOffset === 1 ? '' : 's'} Ahead`}
                        </span>
                        <button
                            onClick={() => setDayOffset(prev => prev + 7)}
                            className="text-[11px] font-semibold px-2 py-1.5 rounded bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 transition-colors"
                        >
                            Next Week &rarr;
                        </button>
                        {dayOffset !== 0 && (
                            <button
                                onClick={() => setDayOffset(0)}
                                className="text-[11px] text-gray-400 hover:text-white transition-colors underline ml-1"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                }
            />

            {/* ── Timezone Note & Mobile Day Navigation ── */}
            <div className="flex flex-col sm:flex-row sm:justify-end px-4 py-1.5 gap-2" style={{ backgroundColor: "#2b2b2b" }}>
                {/* Desktop Timezone Note */}
                <span className="text-[10px] italic text-gray-400 hidden sm:block">
                    *All times in your timezone
                </span>

                {/* Mobile Day Navigation (visible only on small screens) */}
                <div className="flex sm:hidden items-center justify-between w-full pt-1 pb-1">
                    <button
                        onClick={() => setDayOffset(prev => prev - 1)}
                        className="text-xs font-semibold px-3 py-2 rounded bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 transition-colors"
                    >
                        &larr; Prev Day
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-200">
                            {dayOffset === 0 ? "Today" : DAY_NAMES[selectedDayIndex]}
                        </span>
                        {dayOffset !== 0 && (
                            <button
                                onClick={() => setDayOffset(0)}
                                className="text-[10px] text-gray-400 hover:text-white underline mt-0.5"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setDayOffset(prev => prev + 1)}
                        className="text-xs font-semibold px-3 py-2 rounded bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 transition-colors"
                    >
                        Next Day &rarr;
                    </button>
                </div>

                {/* Mobile Timezone Note */}
                <span className="text-[10px] italic text-gray-400 self-end sm:hidden">
                    *All times in your timezone
                </span>
            </div>

            {/* ── Calendar Header ── */}
            <CalendarHeader days={weekSchedule} watchlist={watchlist} allRomajiTitles={allRomajiTitles} />

            {/* ── Loading State ── */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                    <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
                    <p className="mt-4 text-sm">Loading anime schedule…</p>
                </div>
            )}

            {/* ── Loading Overlay (when fetching new week) ── */}
            {!isLoading && isFetching && (
                <div className="fixed top-20 right-4 z-50 rounded bg-brand-blue/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Fetching schedule...
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
                                day.isSelected
                                    ? "grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 md:flex md:flex-col md:gap-px md:p-0"
                                    : "hidden md:flex md:flex-col md:gap-px md:p-0"
                            }
                            style={{
                                backgroundColor: day.isSelected
                                    ? "rgba(58, 117, 196, 0.08)"
                                    : "#2b2b2b",
                            }}
                        >
                            {day.shows.length === 0 ? (
                                <div className="col-span-full flex min-h-[120px] items-center justify-center text-xs text-gray-600">
                                    No shows
                                </div>
                            ) : (
                                (() => {
                                    // For today's column on the current week, insert the NowIndicator
                                    // between already-aired and upcoming shows
                                    const isCurrentWeekToday = day.isToday && weekOffset === 0;
                                    if (!isCurrentWeekToday) {
                                        return day.shows.map((anime, index) => (
                                            <AnimeCard key={`${anime.id}-${anime.airTime}-${anime.releaseType}-${index}`} anime={anime} showCountdown={false} />
                                        ));
                                    }

                                    const nowMs = now.getTime();
                                    // Find the index of the first show that hasn't aired yet
                                    const firstUpcomingIdx = day.shows.findIndex(
                                        (s) => new Date(s.airTime).getTime() > nowMs
                                    );

                                    // All shows aired → put indicator at the end
                                    // No shows aired → put indicator at the top
                                    // Otherwise → insert between aired and upcoming
                                    const insertIdx = firstUpcomingIdx === -1
                                        ? day.shows.length
                                        : firstUpcomingIdx;

                                    const elements: React.ReactNode[] = [];
                                    day.shows.forEach((anime, index) => {
                                        if (index === insertIdx) {
                                            elements.push(
                                                <div key="now-indicator" className="col-span-full">
                                                    <NowIndicator />
                                                </div>
                                            );
                                        }
                                        elements.push(
                                            <AnimeCard key={`${anime.id}-${anime.airTime}-${anime.releaseType}-${index}`} anime={anime} showCountdown={true} />
                                        );
                                    });

                                    // If indicator goes at the end (all shows aired)
                                    if (insertIdx === day.shows.length) {
                                        elements.push(
                                            <div key="now-indicator" className="col-span-full">
                                                <NowIndicator />
                                            </div>
                                        );
                                    }

                                    return elements;
                                })()
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
