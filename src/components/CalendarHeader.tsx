"use client";

import type { DaySchedule } from "@/types/types";

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
}

export default function CalendarHeader({ days }: CalendarHeaderProps) {
    return (
        <div className="grid grid-cols-7 border-b border-gray-700">
            {days.map((day) => (
                <div
                    key={day.dayIndex}
                    className={`
            flex flex-col items-center justify-center py-3 px-1 text-center transition-colors
            ${day.isToday
                            ? "bg-brand-blue text-white"
                            : "bg-surface text-gray-300"
                        }
          `}
                >
                    <span className="text-[11px] font-medium opacity-80">
                        {day.dateLabel}
                    </span>
                    <span className={`text-sm font-bold ${day.isToday ? "text-white" : "text-gray-100"}`}>
                        {day.dayName}
                    </span>
                </div>
            ))}
        </div>
    );
}
