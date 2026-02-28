"use client";

import type { DaySchedule } from "@/types/types";
import DayDropdown from "./DayDropdown";

// ─────────────────────────────────────────────────────────
// CalendarHeader — 7-column header row showing each day
//
//  ┌────────┬────────┬───────────┬──────────┬────────┬──══════════┬────────┐
//  │ 23 Feb │ 24 Feb │  25 Feb   │  26 Feb  │ 27 Feb │  28 Feb    │ 1 Mar  │
//  │ Monday │Tuesday │ Wednesday │ Thursday │ Friday │ *Saturday* │ Sunday │
//  └────────┴────────┴───────────┴──────────┴────────┴──══════════┴────────┘
//                                                      ↑ today highlighted
// ─────────────────────────────────────────────────────────

interface CalendarHeaderProps {
    days: DaySchedule[];
    watchlist: string[];
    allRomajiTitles: string[];
}

export default function CalendarHeader({ days, watchlist, allRomajiTitles }: CalendarHeaderProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-7 border-b border-gray-700">
            {days.map((day) => (
                <div
                    key={day.dayIndex}
                    className={`
            relative py-3 px-1 text-center transition-colors
            ${day.isToday
                            ? "flex flex-col items-center justify-center bg-brand-blue text-white"
                            : "hidden md:flex md:flex-col md:items-center md:justify-center bg-surface text-gray-300"
                        }
          `}
                >
                    <span className="text-[11px] font-medium opacity-80">
                        {day.dateLabel}
                    </span>
                    <span className={`text-sm font-bold ${day.isToday ? "text-white" : "text-gray-100"}`}>
                        {day.dayName}
                    </span>
                    <DayDropdown shows={day.shows} watchlist={watchlist} allRomajiTitles={allRomajiTitles} />
                </div>
            ))}
        </div>
    );
}
