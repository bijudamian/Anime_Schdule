"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import DownloadWatchlistButton from "./DownloadWatchlistButton";
import type { AnimeCardData } from "@/types/types";
import { generateUniqueAbbreviation } from "@/lib/torrentUtils";

interface Props {
    shows: AnimeCardData[];
    watchlist: string[];
    allRomajiTitles: string[];
}

export default function DayDropdown({ shows, watchlist, allRomajiTitles }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Compute the precise torrent queries for shows in the user's watchlist for this day
    const downloadItems = shows
        .filter((show) => watchlist.includes(show.id))
        .map((show) => {
            const romaji = show.romaji || show.title;
            return {
                query: generateUniqueAbbreviation(romaji, allRomajiTitles),
                expectedEpisode: show.episodeNumber || 1,
                originalTitle: show.english || show.title || show.romaji || "Unknown Title"
            };
        });

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (downloadItems.length === 0) return null;

    return (
        <div className="absolute top-1 right-1" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-sm p-1 text-gray-400 hover:bg-black/20 hover:text-white transition-colors"
                title="Day Options"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded bg-[#2b2b2b] p-2 shadow-lg ring-1 ring-black/50">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase px-1">
                            Actions
                        </span>
                        <DownloadWatchlistButton downloadItems={downloadItems} />
                    </div>
                </div>
            )}
        </div>
    );
}
