"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────
// AnimeContextMenu — appears on right-click on any anime tile
//
// Options:
//   • Download All Previous Episodes
// ─────────────────────────────────────────────────────────

interface AnimeContextMenuProps {
    x: number;
    y: number;
    anime: {
        id: string;
        title: string;
        romaji: string | null;
        english: string | null;
        episodeNumber: number | null;
        releaseType: "SUB" | "DUB" | "RAW";
    };
    onClose: () => void;
}

export default function AnimeContextMenu({ x, y, anime, onClose }: AnimeContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        function handleEsc(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [onClose]);

    // Reposition if menu overflows viewport
    const [pos, setPos] = useState({ x, y });
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const newX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 8 : x;
        const newY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 8 : y;
        setPos({ x: newX, y: newY });
    }, [x, y]);

    const handleDownloadAll = async () => {
        if (downloading) return;
        const totalEps = (anime.episodeNumber ?? 1) - 1;
        if (totalEps < 1) {
            setStatus("No previous episodes");
            setTimeout(onClose, 1500);
            return;
        }

        setDownloading(true);
        setStatus(`Fetching ${totalEps} episode${totalEps > 1 ? "s" : ""}...`);

        try {
            const res = await fetch("/api/download-all-episodes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: anime.title,
                    romaji: anime.romaji,
                    english: anime.english,
                    totalEpisodes: totalEps,
                    releaseType: anime.releaseType,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Download failed" }));
                setStatus(data.error || "Download failed");
                setTimeout(onClose, 2000);
                return;
            }

            // Download the zip
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const cleanTitle = anime.title.replace(/[\/\\?%*:|"<>]/g, "-").trim();
            a.download = `${cleanTitle} - All Episodes.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus("Download complete!");
            setTimeout(onClose, 1000);
        } catch (err) {
            console.error("Download all episodes failed:", err);
            setStatus("Network error");
            setTimeout(onClose, 2000);
        } finally {
            setDownloading(false);
        }
    };

    const totalPrev = (anime.episodeNumber ?? 1) - 1;

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[220px] rounded-md border border-gray-600 shadow-2xl overflow-hidden"
            style={{
                left: pos.x,
                top: pos.y,
                backgroundColor: "#1e1e1e",
            }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-700">
                <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{anime.title}</p>
                {anime.episodeNumber != null && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        Currently on Ep {anime.episodeNumber}
                    </p>
                )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
                <button
                    onClick={handleDownloadAll}
                    disabled={downloading || totalPrev < 1}
                    className={`
                        w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors
                        ${downloading || totalPrev < 1
                            ? "text-gray-500 cursor-not-allowed"
                            : "text-gray-200 hover:bg-white/10 cursor-pointer"
                        }
                    `}
                >
                    {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    <span>
                        {status
                            ? status
                            : totalPrev < 1
                                ? "No previous episodes"
                                : `Download All Prev Episodes (${totalPrev})`
                        }
                    </span>
                </button>
            </div>
        </div>
    );
}
