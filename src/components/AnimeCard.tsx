"use client";

import Image from "next/image";
import { Bookmark, X } from "lucide-react";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import Countdown from "./Countdown";
import type { AnimeCardData } from "@/types/types";

// ─────────────────────────────────────────────────────────
// AnimeCard — individual anime entry in a timetable column
//
// Behavior:
//   • Click anywhere on the tile → toggles bookmark
//   • Hover → shows bookmark + hide (X) overlay buttons
//   • Both buttons on the overlay also work independently
// ─────────────────────────────────────────────────────────

interface AnimeCardProps {
    anime: AnimeCardData;
    /** When true, show a live countdown timer next to the air time */
    showCountdown?: boolean;
}

/** Base URL for AnimeSchedule CDN images */
const CDN_BASE = "https://img.animeschedule.net/production/assets/public/img/";

export default function AnimeCard({ anime, showCountdown = false }: AnimeCardProps) {
    const { isWatching, toggleAnime, toggleHidden } = useWatchlistStore();
    const watched = isWatching(anime.id);

    const imageUrl = anime.imageUrl
        ? `${CDN_BASE}${anime.imageUrl}`
        : "/placeholder.png";

    return (
        <div
            className="group relative w-full overflow-hidden rounded-sm cursor-pointer"
            style={{ aspectRatio: "3/4" }}
            onClick={() => toggleAnime(anime.id)}
        >
            {/* ── Background Cover Image ── */}
            <Image
                src={imageUrl}
                alt={anime.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 14vw"
                unoptimized
            />

            {/* ── Top Info Bar ── */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
                {/* Episode number */}
                <span className="whitespace-nowrap">
                    {anime.episodeNumber != null ? `Ep ${anime.episodeNumber}` : "—"}
                </span>

                {/* Air time in local timezone + optional countdown */}
                <span className="font-bold text-center flex flex-col items-center leading-tight">
                    <span>{anime.localTime}</span>
                    {showCountdown && (
                        <Countdown airTime={anime.airTime} />
                    )}
                </span>

                {/* Release type: SUB / DUB / RAW */}
                <span className="rounded px-1 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                        backgroundColor:
                            anime.releaseType === "SUB"
                                ? "rgba(58, 117, 196, 0.6)"
                                : anime.releaseType === "DUB"
                                    ? "rgba(76, 175, 80, 0.6)"
                                    : "rgba(100, 100, 100, 0.6)",
                    }}>
                    {anime.releaseType}
                </span>
            </div>

            {/* ── Delayed / Hiatus Status Bar ── */}
            {(anime.isDelayed || anime.isHiatus) && (
                <div className="absolute top-[26px] left-0 right-0 z-10 py-0.5 text-center text-[10px] font-bold"
                    style={{ backgroundColor: "#f0c040", color: "#222" }}>
                    {anime.isHiatus ? "HIATUS" : "DELAYED"}
                </div>
            )}

            {/* ── Bottom Gradient + Title ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-2 pb-2 pt-8"
                style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
                }}>
                <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white drop-shadow-md">
                    {anime.title}
                </p>
            </div>

            {/* ── Hover: Bookmark + Hide Overlay ── */}
            <div
                className="absolute inset-0 z-20 flex items-center justify-center gap-4 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
                {/* Bookmark button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleAnime(anime.id);
                    }}
                    className="flex items-center justify-center rounded-full bg-black/30 p-2 transition-transform duration-150 hover:scale-110 hover:bg-black/50"
                    title={watched ? "Remove from watchlist" : "Add to watchlist"}
                >
                    <Bookmark
                        className={`h-7 w-7 ${watched
                            ? "fill-brand-blue text-brand-blue"
                            : "fill-none text-white"
                            }`}
                    />
                </button>

                {/* Hide button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleHidden(anime.id);
                    }}
                    className="flex items-center justify-center rounded-full bg-black/30 p-2 transition-transform duration-150 hover:scale-110 hover:bg-red-900/50"
                    title="Hide from dashboard"
                >
                    <X className="h-7 w-7 text-red-400" />
                </button>
            </div>

            {/* ── Persistent bookmark indicator (when watched) ── */}
            {watched && (
                <div className="absolute top-[26px] right-1 z-20 pointer-events-none">
                    <Bookmark className="h-4 w-4 fill-brand-blue text-brand-blue drop-shadow" />
                </div>
            )}
        </div>
    );
}
