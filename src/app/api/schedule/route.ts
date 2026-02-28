import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// GET /api/schedule
// Secure proxy for the AnimeSchedule v3 timetable API.
// Attaches the Bearer token server-side so it is NEVER
// exposed to the client browser.
// ─────────────────────────────────────────────────────────

const API_BASE = process.env.ANIMESCHEDULE_API_BASE || "https://animeschedule.net/api/v3";
const TOKEN = process.env.ANIMESCHEDULE_TOKEN;

export async function GET(request: Request) {
    if (!TOKEN) {
        return NextResponse.json(
            { error: "API token is not configured on the server." },
            { status: 500 }
        );
    }

    try {
        // Forward any query parameters from the client request
        const { searchParams } = new URL(request.url);
        const queryString = searchParams.toString();
        const apiUrl = `${API_BASE}/timetables${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(apiUrl, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            // Re-validate every 10 minutes to avoid hammering the API
            next: { revalidate: 600 },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[API Proxy] AnimeSchedule API error: ${response.status}`,
                errorText
            );
            return NextResponse.json(
                {
                    error: `AnimeSchedule API returned ${response.status}`,
                    details: errorText,
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                // Allow the browser to cache for 5 minutes
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            },
        });
    } catch (error) {
        console.error("[API Proxy] Failed to fetch timetable:", error);
        return NextResponse.json(
            { error: "Failed to fetch schedule data from upstream API." },
            { status: 502 }
        );
    }
}
