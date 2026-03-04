import { NextResponse } from "next/server";
import JSZip from "jszip";

// ─── XML / CDATA helpers ──────────────────────────────────────────────────────

function stripCdata(str: string): string {
    return str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

// ─── Episode extraction ───────────────────────────────────────────────────────

/**
 * Extracts the episode number from a torrent title string.
 *
 * Handles common release group patterns, e.g.:
 *   [SubsPlease] Dungeon Meshi - 13 (1080p) [ABCD1234].mkv
 *   [HorribleSubs] One Piece - 1050 [720p].mkv
 *   Show Name S01E04 [720p]
 *   Show Name EP12 [1080p]
 *   Show Name 2x05 ...
 */
export function extractEpisodeNumber(title: string): number | null {
    const patterns: RegExp[] = [
        // "- 13 " style (most common on Nyaa)
        /(?:^|[\s\-–])-\s*(\d{1,4})(?:\s*v\d+)?\s*(?:\(|\[|$)/i,
        // S01E04 / S1E4
        /[Ss]\d{1,2}[Ee](\d{1,4})/,
        // 2x05
        /\d{1,2}x(\d{1,4})/,
        // EP12 / Ep.12 / Episode 12
        /(?:ep\.?|episode\s*)(\d{1,4})/i,
        // " 12 " surrounded by spaces/brackets/end — last resort
        /[\s\[(](\d{1,4})[\s\])\-]/,
    ];

    for (const re of patterns) {
        const m = title.match(re);
        if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n >= 1) return n;
        }
    }
    return null;
}

// ─── Fuzzy title matching ─────────────────────────────────────────────────────

/**
 * Normalises a string for comparison: lowercase, strip punctuation, collapse spaces.
 */
function normaliseTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")   // strip punctuation
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Tokenises a normalised title into a Set of words, filtering out very short
 * tokens (articles, particles) that add noise.
 */
function tokenise(title: string): Set<string> {
    const STOP = new Set(["no", "wo", "wa", "ga", "ni", "de", "to", "na", "the", "a", "an", "of", "in"]);
    return new Set(
        normaliseTitle(title)
            .split(" ")
            .filter((w) => w.length > 1 && !STOP.has(w))
    );
}

/**
 * Jaccard similarity between two token sets: |intersection| / |union|.
 * Returns a value in [0, 1].
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    const intersection = [...a].filter((t) => b.has(t)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
}

/**
 * Extracts the "show title" portion from a typical Nyaa torrent filename by
 * stripping leading release-group tags and trailing metadata brackets/episode info.
 *
 * "[SubsPlease] Okiraku Ryoushu no Tanoshii - 09 (1080p) [ABCD].mkv"
 *   → "Okiraku Ryoushu no Tanoshii"
 */
function extractShowTitleFromTorrent(torrentTitle: string): string {
    // Remove leading [GroupTag]
    let t = torrentTitle.replace(/^\s*\[[^\]]*\]\s*/, "");
    // Remove file extension
    t = t.replace(/\.\w{2,4}$/, "");
    // Cut at " - <digits>" (episode marker) — everything before is the show title
    t = t.replace(/\s*[-–]\s*\d{1,4}(?:\s*v\d+)?\s*[\(\[].*$/, "");
    // Cut at S01E / EP / Episode
    t = t.replace(/\s+(?:[Ss]\d{1,2}[Ee]\d{1,4}|[Ee][Pp]\.?\d{1,4}|[Ee]pisode\s*\d{1,4}).*$/, "");
    return t.trim();
}

/**
 * Returns true if the torrent title matches the full canonical anime name at
 * >= the given similarity threshold (default 0.35 ≈ 35%).
 */
function titleMatchesFuzzy(
    torrentTitle: string,
    canonicalFullTitle: string,
    threshold = 0.35
): boolean {
    const extractedShow = extractShowTitleFromTorrent(torrentTitle);
    const showTokens = tokenise(extractedShow);
    const canonicalTokens = tokenise(canonicalFullTitle);
    const score = jaccardSimilarity(showTokens, canonicalTokens);

    console.log(
        `  fuzzy "${extractedShow}" vs "${canonicalFullTitle}" → ${(score * 100).toFixed(1)}%`
    );

    return score >= threshold;
}

// ─── AnimeSchedule API ────────────────────────────────────────────────────────

interface AnimeScheduleEntry {
    title: string;           // romaji title
    englishTitle?: string;
    route?: string;
    episodeNumber?: number;  // latest aired episode on AnimeSchedule
    episodes?: number;       // total episode count (if complete)
}

/**
 * Searches AnimeSchedule for a show and returns the best-matching entry.
 * AnimeSchedule v3 private API requires an Authorization Bearer token.
 * Set ANIMESCHEDULE_TOKEN in your environment variables.
 *
 * Endpoint: GET /api/v3/anime?title=<query>&per-page=5
 * Returns: { anime: AnimeScheduleEntry[] }
 */
async function fetchAnimeScheduleEntry(query: string): Promise<AnimeScheduleEntry | null> {
    try {
        const token = process.env.ANIMESCHEDULE_TOKEN;
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const url = `https://animeschedule.net/api/v3/anime?title=${encodeURIComponent(query)}&per-page=5`;
        const res = await fetch(url, { headers });
        if (!res.ok) return null;

        const data = await res.json();

        // The API returns { anime: AnimeScheduleEntry[] } or a direct array
        const entries: AnimeScheduleEntry[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.anime)
                ? data.anime
                : [];

        if (entries.length === 0) return null;

        // Pick the best match: prefer exact title match first, then first result
        const normalised = query.toLowerCase().trim();
        const exact = entries.find(
            (e) =>
                e.englishTitle?.toLowerCase() === normalised ||
                e.title?.toLowerCase() === normalised
        );

        return exact ?? entries[0];
    } catch (err) {
        console.warn(`AnimeSchedule lookup failed for "${query}":`, err);
        return null;
    }
}

/**
 * Fetches the full AnimeSchedule entry by its route slug to get accurate
 * episode airing info (episodeNumber = latest aired episode).
 *
 * Endpoint: GET /api/v3/anime/<route>
 */
async function fetchAnimeScheduleDetail(route: string): Promise<AnimeScheduleEntry | null> {
    try {
        const token = process.env.ANIMESCHEDULE_TOKEN;
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const url = `https://animeschedule.net/api/v3/anime/${encodeURIComponent(route)}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return null;

        return await res.json();
    } catch (err) {
        console.warn(`AnimeSchedule detail fetch failed for "${route}":`, err);
        return null;
    }
}

// ─── Nyaa search ─────────────────────────────────────────────────────────────

interface NyaaResult {
    title: string;
    torrentUrl: string;
    seeders: number;
}

/**
 * Queries Nyaa RSS with the given search string and returns all items,
 * including seeder counts parsed from <nyaa:seeders>.
 * Category 1_2 = Anime – English-translated, f=0 = no filter.
 */
async function searchNyaa(searchQuery: string): Promise<NyaaResult[]> {
    const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(searchQuery)}&c=1_2&f=0`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];

    const xml = await res.text();
    const results: NyaaResult[] = [];

    const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
    for (const block of items) {
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
        const seederMatch = block.match(/<nyaa:seeders>([\s\S]*?)<\/nyaa:seeders>/i);

        if (titleMatch && linkMatch) {
            const title = stripCdata(titleMatch[1].trim());
            const torrentUrl = linkMatch[1].trim();
            const seeders = seederMatch ? parseInt(seederMatch[1].trim(), 10) || 0 : 0;

            if (torrentUrl.startsWith("http")) {
                results.push({ title, torrentUrl, seeders });
            }
        }
    }
    return results;
}

/**
 * Core search strategy:
 *
 * 1. Extract the FIRST WORD of the romaji title and search Nyaa with just that.
 * 2. For each result, extract the show-title portion and compare it against the
 *    full canonical anime name using Jaccard similarity (threshold ≥ 35%).
 * 3. Among matching results, keep only those whose embedded episode number
 *    equals `expectedEpisode`.
 * 4. Return the candidate with the highest seeder count.
 *
 * Falls back to the full query if the first-word search yields no fuzzy matches.
 */
async function findBestTorrent(
    romajiTitle: string,     // romaji title from AnimeSchedule (used for Nyaa search)
    fullCanonicalTitle: string, // full title used for fuzzy matching
    expectedEpisode: number
): Promise<NyaaResult | null> {

    async function searchAndFilter(query: string): Promise<NyaaResult[]> {
        const results = await searchNyaa(query);
        return results.filter(
            (r) =>
                titleMatchesFuzzy(r.title, fullCanonicalTitle) &&
                extractEpisodeNumber(r.title) === expectedEpisode
        );
    }

    // ── Pass 1: search with only the first word of the romaji title ──────────
    const firstWord = romajiTitle.split(/\s+/)[0];
    console.log(`  [Pass 1] Searching Nyaa for first word: "${firstWord}"`);
    let candidates = await searchAndFilter(firstWord);

    // ── Pass 2: fall back to full romaji title if needed ────────────────────
    if (candidates.length === 0 && firstWord !== romajiTitle) {
        await new Promise((r) => setTimeout(r, 500));
        console.log(`  [Pass 2] Falling back to full romaji query: "${romajiTitle}"`);
        candidates = await searchAndFilter(romajiTitle);
    }

    // ── Pass 3: fall back to the original user query if still nothing ────────
    if (candidates.length === 0 && fullCanonicalTitle !== romajiTitle) {
        await new Promise((r) => setTimeout(r, 500));
        const altFirst = fullCanonicalTitle.split(/\s+/)[0];
        if (altFirst !== firstWord) {
            console.log(`  [Pass 3] Trying canonical title first word: "${altFirst}"`);
            candidates = await searchAndFilter(altFirst);
        }
    }

    if (candidates.length === 0) return null;

    // Pick the candidate with the most seeders
    candidates.sort((a, b) => b.seeders - a.seeders);
    return candidates[0];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { items } = await req.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "Invalid items array" }, { status: 400 });
        }

        const zip = new JSZip();
        let foundCount = 0;

        for (const item of items) {
            const { query, expectedEpisode, originalTitle } = item as {
                query: string;
                expectedEpisode: number;
                originalTitle: string;
            };

            try {
                // ── 1. Resolve romaji title + latest episode from AnimeSchedule ──
                const scheduleEntry = await fetchAnimeScheduleEntry(query);

                // Romaji title for Nyaa search; fall back to the user's query
                const romajiTitle: string = scheduleEntry?.title ?? query;

                // Full canonical name used for fuzzy matching;
                // prefer the longer of scheduleEntry.title vs originalTitle
                const canonicalTitle: string =
                    scheduleEntry?.title && scheduleEntry.title.length >= originalTitle.length
                        ? scheduleEntry.title
                        : originalTitle;

                // Fetch full detail to get the latest aired episode number
                let latestAiredEpisode: number | null = null;
                if (scheduleEntry?.route) {
                    const detail = await fetchAnimeScheduleDetail(scheduleEntry.route);
                    // AnimeSchedule stores the latest AIRED episode in episodeNumber
                    latestAiredEpisode = detail?.episodeNumber ?? null;
                }

                // Warn if requested episode is beyond what has aired
                if (latestAiredEpisode !== null && expectedEpisode > latestAiredEpisode) {
                    console.warn(
                        `[${originalTitle}] Requested episode ${expectedEpisode} but only ` +
                        `${latestAiredEpisode} have aired — skipping.`
                    );
                    continue;
                }

                console.log(
                    `[${originalTitle}] romaji="${romajiTitle}" canonical="${canonicalTitle}" ` +
                    `ep=${expectedEpisode} latestAired=${latestAiredEpisode ?? "unknown"}`
                );

                // ── 2. Find the best matching torrent on Nyaa ─────────────────
                const best = await findBestTorrent(romajiTitle, canonicalTitle, expectedEpisode);

                if (!best) {
                    console.warn(`No matching torrent found for: ${originalTitle} ep ${expectedEpisode}`);
                    continue;
                }

                console.log(
                    `✓ Best match: "${best.title}" | seeders=${best.seeders} | url=${best.torrentUrl}`
                );

                // ── 3. Download the torrent file ──────────────────────────────
                const dlRes = await fetch(best.torrentUrl);
                if (!dlRes.ok) {
                    console.warn(`Download failed for: ${best.torrentUrl}`);
                    continue;
                }

                const buffer = await dlRes.arrayBuffer();
                const cleanTitle = originalTitle
                    .replace(/[\/\\?%*:|"<>]/g, "-")
                    .replace(/\s+/g, " ")
                    .trim();
                const fileName = `${cleanTitle} - ${expectedEpisode}.torrent`;

                zip.file(fileName, buffer);
                foundCount++;

                console.log(`  → Added to zip: ${fileName}`);
            } catch (e) {
                console.error(`Failed processing "${originalTitle}":`, e);
            }
        }

        if (foundCount === 0) {
            return NextResponse.json({ error: "No torrents found." }, { status: 404 });
        }

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

        return new Response(zipBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": 'attachment; filename="watchlist_torrents.zip"',
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}