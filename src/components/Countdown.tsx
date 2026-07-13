"use client";

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────
// Countdown — live ticking timer showing time until air
//
// Before air:  "1h 27m 20s"  (colored, ticking)
// After air:   "Aired"       (dimmed)
// ─────────────────────────────────────────────────────────

interface CountdownProps {
    /** ISO datetime string of the episode's air time */
    airTime: string;
}

export default function Countdown({ airTime }: CountdownProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const airMs = new Date(airTime).getTime();
    const diffMs = airMs - now;

    // Already aired
    if (diffMs <= 0) {
        return (
            <span className="text-[9px] font-semibold text-emerald-400/70 uppercase tracking-wider">
                Aired
            </span>
        );
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format: "1h 27m 20s" or "27m 20s" or "20s"
    let parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    // Color coding: <1h = orange/urgent, <5m = red/flashing, else sky
    const isUrgent = totalSeconds < 300; // < 5 min
    const isSoon = totalSeconds < 3600;  // < 1 hour

    return (
        <span
            className={`
                text-[9px] font-bold tabular-nums tracking-wide
                ${isUrgent
                    ? "text-red-400 animate-pulse"
                    : isSoon
                        ? "text-amber-400"
                        : "text-sky-400/80"
                }
            `}
        >
            {parts.join(" ")}
        </span>
    );
}
