"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export interface DownloadItem {
    query: string;
    expectedEpisode: number;
    originalTitle: string;
}

interface Props {
    downloadItems: DownloadItem[];
}

export default function DownloadWatchlistButton({ downloadItems }: Props) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (downloadItems.length === 0) return;

        try {
            setIsDownloading(true);

            const res = await fetch("/api/watchlist-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: downloadItems }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Download failed");
            }

            // Convert response to blob
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);

            // Trigger download
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = "watchlist_torrents.zip";
            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err: any) {
            alert("Failed to download torrents: " + err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    if (downloadItems.length === 0) return null;

    return (
        <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex w-full justify-center items-center gap-1.5 rounded-sm bg-brand-blue/20 text-brand-blue px-3 py-1.5 text-xs font-semibold select-none cursor-pointer transition-colors hover:bg-brand-blue/30 disabled:opacity-50 disabled:cursor-not-allowed border border-brand-blue/30"
        >
            {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Download className="h-3.5 w-3.5" />
            )}
            {isDownloading ? `Preparing...` : `Download All (${downloadItems.length})`}
        </button>
    );
}
