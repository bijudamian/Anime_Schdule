"use client";

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────
// NowIndicator — a horizontal "now" line that sits between
// already-aired and upcoming anime in today's column.
//
// Shows: ● ─────── 11:27 PM ─────── ●
// ─────────────────────────────────────────────────────────

export default function NowIndicator() {
    const [now, setNow] = useState(new Date());

    // Tick every 30 seconds for a live feel
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(interval);
    }, []);

    const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    const tzOffset = now.toLocaleTimeString("en-US", {
        timeZoneName: "shortOffset",
    }).split(" ").pop() || "";

    return (
        <div className="now-indicator relative flex items-center gap-2 py-1.5 px-2 w-full select-none">
            {/* Left pulsing dot */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
            </span>

            {/* Left line */}
            <div className="flex-1 h-px bg-gradient-to-r from-sky-500 to-sky-500/40" />

            {/* Time badge */}
            <span className="shrink-0 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-400 tracking-wide whitespace-nowrap backdrop-blur-sm">
                {timeStr}
                <span className="ml-1 text-sky-500/60 font-medium">{tzOffset}</span>
            </span>

            {/* Right line */}
            <div className="flex-1 h-px bg-gradient-to-l from-sky-500 to-sky-500/40" />

            {/* Right pulsing dot */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
            </span>
        </div>
    );
}
