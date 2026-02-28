// ─────────────────────────────────────────────────────────
// Type definitions for AnimeSchedule API v3 timetable data
// ─────────────────────────────────────────────────────────

/** Media type object from the API */
export interface MediaTypeEntry {
    name: string;
    route: string;
}

/** A single anime entry from the timetable API response */
export interface TimetableShow {
    /** The anime's route/slug used as a unique identifier */
    route: string;
    /** The anime title (romaji or primary) */
    title: string | null;
    /** The anime title in romaji */
    romaji: string | null;
    /** The anime title in english */
    english: string | null;
    /** The anime title in native script */
    native: string | null;
    /** Episode number airing */
    episodeNumber: number | null;
    /** Total number of episodes (may be null for ongoing) */
    episodes: number | null;
    /** The CDN image path slug */
    imageVersionRoute: string | null;
    /** ISO 8601 datetime string of the episode's air time (UTC) */
    episodeDate: string;
    /** Array of media type objects */
    mediaTypes: MediaTypeEntry[] | null;
    /** Air type: "raw", "sub", "dub" */
    airType: string | null;
    /** Current overall status: "Ongoing", "Delayed", etc. */
    status: string | null;
    /** Airing status: "aired", "unaired", "delayed-air" */
    airingStatus: string | null;
    /** Delay info */
    delayedFrom: string | null;
    delayedUntil: string | null;
    delayedText: string | null;
    /** Whether the anime is of type Donghua (Chinese animation) */
    donghua: boolean;
}

/** Normalized anime card data for the frontend */
export interface AnimeCardData {
    id: string;
    title: string;
    episodeNumber: number | null;
    imageUrl: string;
    airTime: string; // ISO datetime string
    localTime: string; // Formatted local time string (e.g. "07:00 PM")
    mediaType: string;
    releaseType: "SUB" | "DUB" | "RAW";
    isDelayed: boolean;
    isHiatus: boolean;
    statusText: string | null;
    donghua: boolean;
    dayOfWeek: number; // 0 = Monday, 6 = Sunday
}

/** A day's schedule — grouped anime cards */
export interface DaySchedule {
    dayIndex: number; // 0 = Monday, 6 = Sunday
    dayName: string;
    dateLabel: string; // e.g. "23 Feb"
    isToday: boolean;
    shows: AnimeCardData[];
}

/** Filter state for the timetable view */
export interface FilterState {
    showWatchlistOnly: boolean;
    noDonghua: boolean;
    tvOnly: boolean;
    onaOnly: boolean;
    subOnly: boolean;
    dubOnly: boolean;
}
