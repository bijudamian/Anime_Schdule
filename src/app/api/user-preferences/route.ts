// ─────────────────────────────────────────────────────────
// API: /api/user-preferences
//
// GET  — Fetch current user's preferences from MongoDB
// PUT  — Upsert current user's preferences to MongoDB
//
// Synced fields:
//   • watchlist           — bookmarked anime route IDs
//   • actuallyWatching    — subset the user is actively following
//   • hiddenAnime         — anime hidden from the dashboard
//   • savedFilterPresets  — two saved filter preset slots
//
// Protected: Requires Clerk auth (returns 401 if not signed in)
// ─────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

const COLLECTION = "user_preferences";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getDb();
        const doc = await db.collection(COLLECTION).findOne({ clerkUserId: userId });

        if (!doc) {
            // Return empty defaults for new users
            return NextResponse.json({
                watchlist: [],
                actuallyWatching: [],
                hiddenAnime: [],
                savedFilterPresets: [null, null],
            });
        }

        return NextResponse.json({
            watchlist: doc.watchlist || [],
            actuallyWatching: doc.actuallyWatching || [],
            hiddenAnime: doc.hiddenAnime || [],
            // Support both old `savedFilters` and new `savedFilterPresets`
            savedFilterPresets: doc.savedFilterPresets ?? [
                doc.savedFilters ?? null,
                null,
            ],
        });
    } catch (error) {
        console.error("[GET /api/user-preferences] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { watchlist, actuallyWatching, hiddenAnime, savedFilterPresets } = body;

        // Validate input
        if (!Array.isArray(watchlist) || !Array.isArray(hiddenAnime)) {
            return NextResponse.json(
                { error: "Invalid body: watchlist and hiddenAnime must be arrays" },
                { status: 400 }
            );
        }

        const db = await getDb();
        await db.collection(COLLECTION).updateOne(
            { clerkUserId: userId },
            {
                $set: {
                    clerkUserId: userId,
                    watchlist,
                    actuallyWatching: Array.isArray(actuallyWatching) ? actuallyWatching : [],
                    hiddenAnime,
                    savedFilterPresets: savedFilterPresets ?? [null, null],
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[PUT /api/user-preferences] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
