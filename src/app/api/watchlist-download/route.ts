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

// ─── Smart title keyword extraction ───────────────────────────────────────────

/**
 * Common stop words that appear frequently in anime titles but aren't
 * unique identifiers. We skip these when looking for "unique" words.
 */
const STOP_WORDS = new Set([
    "no", "wo", "wa", "ga", "ni", "de", "to", "na", "the", "a", "an",
    "of", "in", "is", "it", "and", "or", "my", "i", "me", "he", "she",
    "im", "its", "that", "this", "with", "for", "on", "at", "be",
    "not", "but", "so", "if", "as", "by", "from", "are", "was", "were",
    "been", "has", "have", "had", "do", "does", "did",
]);

/**
 * Extracts unique searchable keywords from an anime title.
 *
 * Strategy: strip ALL non-alphanumeric characters, remove stop words,
 * then pick 1-3 distinctive words that will yield good Nyaa results.
 *
 * Example:
 *   "Heroine? Saint? No, I'm an All-Works Maid (And Proud of it)!"
 *   → "works maid" (unique, specific words)
 *
 *   "Oshi no Ko" → "oshi ko" (skip "no" stop word)
 *   "One Piece" → "one piece"
 */
function extractSearchKeywords(title: string): string {
    // Strip everything that isn't alphanumeric or space
    const cleaned = title
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const words = cleaned.split(" ").filter(
        (w) => w.length > 1 && !STOP_WORDS.has(w.toLowerCase())
    );

    if (words.length === 0) {
        // Fallback: just use all words from cleaned title
        return cleaned.split(" ").slice(0, 3).join(" ");
    }

    // For short titles (1-2 words after filtering), use all of them
    if (words.length <= 2) return words.join(" ");

    // For longer titles, score words by "uniqueness" (length + uncommonness)
    // Prefer longer, less common words as they're more distinctive
    const scored = words.map((w, idx) => ({
        word: w,
        score: w.length + (idx > 2 ? 1 : 0), // slight boost to later words (less generic)
        originalIdx: idx,
    }));

    // Sort by score descending, take top 2
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, 2);

    // Re-sort by original position so the query reads naturally
    selected.sort((a, b) => a.originalIdx - b.originalIdx);

    return selected.map((s) => s.word).join(" ");
}

// ─── Subtitle / audio validation ──────────────────────────────────────────────

/** Known uploaders whose releases always include subtitles */
const TRUSTED_SUB_UPLOADERS = ["subsplease", "erai-raws", "judas", "ember", "yameii"];

/**
 * Checks if a torrent title indicates it has subtitles.
 *
 * Matches: MultiSub, Multi-Subs, multi_sub, .srt, ASS, subtitle, subbed,
 * or if the uploader is a known subbed release group.
 */
function hasSubs(torrentTitle: string): boolean {
    const lower = torrentTitle.toLowerCase();

    // Known subbed uploaders — their releases always have subs
    for (const uploader of TRUSTED_SUB_UPLOADERS) {
        if (lower.includes(`[${uploader}]`)) return true;
    }

    // Explicit subtitle indicators
    const subPatterns = [
        /multi[\s\-_]?sub/i,
        /\bsub(?:s|bed|title)?\b/i,
        /\bass\b/i,      // ASS subtitle format
        /\.srt\b/i,
        /\beng(?:lish)?\s*sub/i,
    ];

    return subPatterns.some((p) => p.test(torrentTitle));
}

/**
 * Checks if a torrent title indicates dual audio or dub.
 * Matches: Dual Audio, Dual.Audio, DualAudio, Dub, Dubbed
 */
function isDualAudioOrDub(torrentTitle: string): boolean {
    const lower = torrentTitle.toLowerCase();
    return /dual[\s.\-_]?audio/i.test(lower) ||
        /\bdub(?:bed)?\b/i.test(lower);
}

/**
 * Checks if the torrent is from a specific uploader.
 */
function isFromUploader(torrentTitle: string, uploader: string): boolean {
    return torrentTitle.toLowerCase().includes(`[${uploader.toLowerCase()}]`);
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

        const entries: AnimeScheduleEntry[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.anime)
                ? data.anime
                : [];

        if (entries.length === 0) return null;

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
 * Fetches the full AnimeSchedule entry by its route slug.
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

// ─── Core search strategy ─────────────────────────────────────────────────────

/**
 * Finds the best matching torrent on Nyaa.
 *
 * Search strategy:
 *   1. Extract smart keywords from the title (handles long/symbolic titles)
 *   2. Search Nyaa with keywords
 *   3. Filter results by episode number
 *   4. If preferDub=true, search for dual audio with "du" suffix first
 *   5. Prefer [ToonsHub] uploader, then fall back to best seeds
 *   6. Require subtitle indicators (unless from trusted uploaders)
 *
 * @param romajiTitle     Romaji title from AnimeSchedule
 * @param englishTitle    English title (used for keyword extraction)
 * @param expectedEpisode The episode number to find
 * @param preferDub       If true, prefer dual audio / dub versions
 */
async function findBestTorrent(
    romajiTitle: string,
    englishTitle: string,
    expectedEpisode: number,
    preferDub: boolean = false
): Promise<NyaaResult | null> {

    /**
     * Filters results to those matching the expected episode and having subs.
     */
    function filterByEpisodeAndSubs(results: NyaaResult[]): NyaaResult[] {
        return results.filter((r) => {
            const ep = extractEpisodeNumber(r.title);
            if (ep !== expectedEpisode) return false;

            // Must have subtitles (either explicit marker or trusted uploader)
            if (!hasSubs(r.title)) return false;

            return true;
        });
    }

    /**
     * Picks the best result from candidates:
     *   1. Prefer [ToonsHub] uploader
     *   2. Fall back to highest seeders
     */
    function pickBest(candidates: NyaaResult[]): NyaaResult | null {
        if (candidates.length === 0) return null;

        // Check for ToonsHub first
        const toonshub = candidates.filter((r) => isFromUploader(r.title, "ToonsHub"));
        if (toonshub.length > 0) {
            toonshub.sort((a, b) => b.seeders - a.seeders);
            console.log(`  ✓ Found [ToonsHub] release: "${toonshub[0].title}"`);
            return toonshub[0];
        }

        // Fall back to highest seeders
        candidates.sort((a, b) => b.seeders - a.seeders);
        console.log(`  ✓ Best by seeders: "${candidates[0].title}" (${candidates[0].seeders} seeds)`);
        return candidates[0];
    }

    // Build search queries from both romaji and english titles
    const romajiKeywords = extractSearchKeywords(romajiTitle);
    const englishKeywords = extractSearchKeywords(englishTitle);

    console.log(`  Keywords: romaji="${romajiKeywords}" english="${englishKeywords}"`);

    // ── If preferDub, try dual audio search first ─────────────────────────────
    if (preferDub) {
        // Search with "du" suffix for dual audio / dub results
        const dubQueries = [
            `${romajiKeywords} du`,
            romajiKeywords !== englishKeywords ? `${englishKeywords} du` : null,
        ].filter(Boolean) as string[];

        for (const q of dubQueries) {
            console.log(`  [DUB Pass] Searching: "${q}"`);
            const results = await searchNyaa(q);
            const dubResults = filterByEpisodeAndSubs(results).filter((r) =>
                isDualAudioOrDub(r.title)
            );
            const best = pickBest(dubResults);
            if (best) return best;
            await new Promise((r) => setTimeout(r, 300));
        }
    }

    // ── Pass 1: search with romaji keywords ──────────────────────────────────
    console.log(`  [Pass 1] Searching: "${romajiKeywords}"`);
    let results = await searchNyaa(romajiKeywords);
    let candidates = filterByEpisodeAndSubs(results);
    let best = pickBest(candidates);
    if (best) return best;

    // ── Pass 2: search with english keywords (if different) ──────────────────
    if (englishKeywords.toLowerCase() !== romajiKeywords.toLowerCase()) {
        await new Promise((r) => setTimeout(r, 300));
        console.log(`  [Pass 2] Searching: "${englishKeywords}"`);
        results = await searchNyaa(englishKeywords);
        candidates = filterByEpisodeAndSubs(results);
        best = pickBest(candidates);
        if (best) return best;
    }

    // ── Pass 3: try first word of romaji (broader search) ────────────────────
    const firstWord = romajiTitle.split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, "");
    if (firstWord && firstWord.toLowerCase() !== romajiKeywords.toLowerCase()) {
        await new Promise((r) => setTimeout(r, 300));
        console.log(`  [Pass 3] Broader search with first word: "${firstWord}"`);
        results = await searchNyaa(firstWord);
        candidates = filterByEpisodeAndSubs(results);
        best = pickBest(candidates);
        if (best) return best;
    }

    // ── Pass 4: try full romaji title (most specific) ────────────────────────
    const cleanRomaji = romajiTitle.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (cleanRomaji.toLowerCase() !== romajiKeywords.toLowerCase()) {
        await new Promise((r) => setTimeout(r, 300));
        console.log(`  [Pass 4] Full romaji: "${cleanRomaji}"`);
        results = await searchNyaa(cleanRomaji);
        candidates = filterByEpisodeAndSubs(results);
        best = pickBest(candidates);
        if (best) return best;
    }

    // ── Pass 5: relax sub requirement — allow any result with seeds ──────────
    console.log(`  [Pass 5] Relaxing subtitle requirement...`);
    for (const q of [romajiKeywords, englishKeywords]) {
        await new Promise((r) => setTimeout(r, 300));
        results = await searchNyaa(q);
        candidates = results.filter((r) => {
            const ep = extractEpisodeNumber(r.title);
            return ep === expectedEpisode && r.seeders > 0;
        });
        // Still prefer ToonsHub even without sub markers
        best = pickBest(candidates);
        if (best) return best;
    }

    console.warn(`  ✗ No results found after all passes`);
    return null;
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

        // ── Group items by title to detect same-day sub+dub ──────────────────
        // If both SUB and DUB exist for the same episode, prefer DUB
        interface DownloadItem {
            query: string;
            expectedEpisode: number;
            originalTitle: string;
            releaseType?: string;  // "SUB" | "DUB" | "RAW"
            romajiTitle?: string;
        }

        const typedItems = items as DownloadItem[];

        // Deduplicate: if both SUB and DUB exist for same title+episode, keep DUB
        const deduped = new Map<string, DownloadItem>();
        for (const item of typedItems) {
            const key = `${item.originalTitle}::${item.expectedEpisode}`;
            const existing = deduped.get(key);

            if (!existing) {
                deduped.set(key, item);
            } else if (item.releaseType === "DUB") {
                // DUB takes priority over SUB for same episode
                console.log(`  [Dedup] Preferring DUB over ${existing.releaseType} for: ${item.originalTitle} ep ${item.expectedEpisode}`);
                deduped.set(key, item);
            }
        }

        for (const item of deduped.values()) {
            const { query, expectedEpisode, originalTitle, releaseType, romajiTitle } = item;

            try {
                // ── 1. Resolve romaji title + latest episode from AnimeSchedule ──
                const scheduleEntry = await fetchAnimeScheduleEntry(query);

                const resolvedRomaji: string = romajiTitle || scheduleEntry?.title || query;
                const resolvedEnglish: string = originalTitle || scheduleEntry?.englishTitle || query;

                // Fetch full detail to get the latest aired episode number
                let latestAiredEpisode: number | null = null;
                if (scheduleEntry?.route) {
                    const detail = await fetchAnimeScheduleDetail(scheduleEntry.route);
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

                const preferDub = releaseType === "DUB";

                console.log(
                    `\n[${originalTitle}] romaji="${resolvedRomaji}" ` +
                    `ep=${expectedEpisode} latestAired=${latestAiredEpisode ?? "unknown"} ` +
                    `preferDub=${preferDub}`
                );

                // ── 2. Find the best matching torrent on Nyaa ─────────────────
                const best = await findBestTorrent(
                    resolvedRomaji,
                    resolvedEnglish,
                    expectedEpisode,
                    preferDub
                );

                if (!best) {
                    console.warn(`✗ No matching torrent found for: ${originalTitle} ep ${expectedEpisode}`);
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