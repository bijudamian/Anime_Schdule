import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// GET /api/schedule
// Secure proxy for the AnimeSchedule v3 timetable API.
// Attaches the Bearer token server-side so it is NEVER
// exposed to the client browser.
// ─────────────────────────────────────────────────────────

const API_BASE = process.env.ANIMESCHEDULE_API_BASE || "https://animeschedule.net/api/v3";
const TOKEN = process.env.ANIMESCHEDULE_TOKEN;
const CLIENT_ID = process.env.ANIMESCHEDULE_CLIENT_ID;

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
                ...(CLIENT_ID ? { "Client-ID": CLIENT_ID } : {}),
                "Content-Type": "application/json",
                "Accept": "application/json",
                // User-Agent is required to avoid Cloudflare bot challenges
                // on Vercel serverless functions (datacenter IPs get flagged without one)
                "User-Agent": "AnimeScheduleDashboard/1.0 (https://anime-schdule.vercel.app)",
                "Accept-Language": "en-US,en;q=0.9",
            },
            // Disable Next.js fetch cache — a cached Cloudflare challenge page
            // would poison subsequent requests for the entire revalidation window
            cache: "no-store",
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
