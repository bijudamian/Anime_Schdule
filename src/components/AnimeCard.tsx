"use client";

import Image from "next/image";
import { Bookmark } from "lucide-react";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import type { AnimeCardData } from "@/types/types";

// ─────────────────────────────────────────────────────────
// AnimeCard — individual anime entry in a timetable column
//
// Layout (from top to bottom):
//   ┌─────────────────────────────┐
//   │  Ep N  │  07:00 PM  │  SUB  │  ← dark semi-transparent bar
//   │─────────────────────────────│
//   │  ⚠ Delayed / Hiatus        │  ← yellow status bar (conditional)
//   │                             │
//   │       (cover image)         │
//   │                             │
//   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← bottom gradient
//   │  Anime Title (2-line clamp) │
//   └─────────────────────────────┘
//   Hover → bookmark overlay
// ─────────────────────────────────────────────────────────

interface AnimeCardProps {
    anime: AnimeCardData;
}

/** Base URL for AnimeSchedule CDN images */
const CDN_BASE = "https://img.animeschedule.net/production/assets/public/img/";

export default function AnimeCard({ anime }: AnimeCardProps) {
    const { isWatching, toggleAnime } = useWatchlistStore();
    const watched = isWatching(anime.id);

    const imageUrl = anime.imageUrl
        ? `${CDN_BASE}${anime.imageUrl}`
        : "/placeholder.png";

    return (
        <div className="group relative w-full overflow-hidden rounded-sm cursor-pointer" style={{ aspectRatio: "3/4" }}>
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

                {/* Air time in local timezone */}
                <span className="font-bold text-center">
                    {anime.localTime}
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

            {/* ── Hover: Bookmark Overlay ── */}
            <div
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleAnime(anime.id);
                }}
            >
                <Bookmark
                    className={`h-8 w-8 transition-transform duration-150 hover:scale-110 ${watched
                            ? "fill-brand-blue text-brand-blue"
                            : "fill-none text-white"
                        }`}
                />
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
