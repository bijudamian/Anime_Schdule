import { NextResponse } from "next/server";
import JSZip from "jszip";
import { extractEpisodeNumber } from "../watchlist-download/route";

// ─── Shared helpers (duplicated from watchlist-download for decoupling) ──────

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

const STOP_WORDS = new Set([
    "no", "wo", "wa", "ga", "ni", "de", "to", "na", "the", "a", "an",
    "of", "in", "is", "it", "and", "or", "my", "i", "me", "he", "she",
    "im", "its", "that", "this", "with", "for", "on", "at", "be",
    "not", "but", "so", "if", "as", "by", "from", "are", "was", "were",
    "been", "has", "have", "had", "do", "does", "did",
]);

function extractSearchKeywords(title: string): string {
    const cleaned = title
        .replace(/'s\b/gi, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const words = cleaned.split(" ").filter(
        (w) => w.length > 1 && !STOP_WORDS.has(w.toLowerCase())
    );

    if (words.length === 0) {
        return cleaned.split(" ").slice(0, 3).join(" ");
    }

    if (words.length <= 2) return words.join(" ");

    const scored = words.map((w, idx) => ({
        word: w,
        score: w.length + (idx > 2 ? 1 : 0),
        originalIdx: idx,
    }));
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, 2);
    selected.sort((a, b) => a.originalIdx - b.originalIdx);
    return selected.map((s) => s.word).join(" ");
}

const TRUSTED_SUB_UPLOADERS = ["subsplease", "erai-raws", "judas", "ember", "yameii"];

function hasSubs(torrentTitle: string): boolean {
    const lower = torrentTitle.toLowerCase();
    for (const uploader of TRUSTED_SUB_UPLOADERS) {
        if (lower.includes(`[${uploader}]`)) return true;
    }
    const subPatterns = [
        /multi[\s\-_]?sub/i,
        /\bsub(?:s|bed|title)?\b/i,
        /\bass\b/i,
        /\.srt\b/i,
        /\beng(?:lish)?\s*sub/i,
    ];
    return subPatterns.some((p) => p.test(torrentTitle));
}

function isDualAudioOrDub(torrentTitle: string): boolean {
    const lower = torrentTitle.toLowerCase();
    return /dual[\s.\-_]?audio/i.test(lower) ||
        /\bdub(?:bed)?\b/i.test(lower);
}

function isFromUploader(torrentTitle: string, uploader: string): boolean {
    return torrentTitle.toLowerCase().includes(`[${uploader.toLowerCase()}]`);
}

// ─── Nyaa search ─────────────────────────────────────────────────────────────

interface NyaaResult {
    title: string;
    torrentUrl: string;
    seeders: number;
}

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

// ─── Find best torrent for a specific episode ────────────────────────────────

async function findBestTorrentForEpisode(
    romajiTitle: string,
    englishTitle: string,
    episode: number,
    preferDub: boolean = false
): Promise<NyaaResult | null> {

    function filterByEpisode(results: NyaaResult[], requireSubs: boolean): NyaaResult[] {
        return results.filter((r) => {
            const ep = extractEpisodeNumber(r.title);
            if (ep !== episode) return false;
            if (requireSubs && !hasSubs(r.title)) return false;
            return true;
        });
    }

    function pickBest(candidates: NyaaResult[]): NyaaResult | null {
        if (candidates.length === 0) return null;
        const toonshub = candidates.filter((r) => isFromUploader(r.title, "ToonsHub"));
        if (toonshub.length > 0) {
            toonshub.sort((a, b) => b.seeders - a.seeders);
            return toonshub[0];
        }
        candidates.sort((a, b) => b.seeders - a.seeders);
        return candidates[0];
    }

    const romajiKeywords = extractSearchKeywords(romajiTitle);
    const englishKeywords = extractSearchKeywords(englishTitle);

    // If preferDub, try dual audio first
    if (preferDub) {
        const dubQueries = [
            `${romajiKeywords} du`,
            romajiKeywords !== englishKeywords ? `${englishKeywords} du` : null,
        ].filter(Boolean) as string[];

        for (const q of dubQueries) {
            const results = await searchNyaa(q);
            const dubResults = filterByEpisode(results, true).filter((r) => isDualAudioOrDub(r.title));
            const best = pickBest(dubResults);
            if (best) return best;
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    // Pass 1: romaji keywords
    let results = await searchNyaa(romajiKeywords);
    let candidates = filterByEpisode(results, true);
    let best = pickBest(candidates);
    if (best) return best;

    // Pass 2: english keywords
    if (englishKeywords.toLowerCase() !== romajiKeywords.toLowerCase()) {
        await new Promise((r) => setTimeout(r, 200));
        results = await searchNyaa(englishKeywords);
        candidates = filterByEpisode(results, true);
        best = pickBest(candidates);
        if (best) return best;
    }

    // Pass 3: first word
    const firstWord = romajiTitle.split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, "");
    if (firstWord && firstWord.toLowerCase() !== romajiKeywords.toLowerCase()) {
        await new Promise((r) => setTimeout(r, 200));
        results = await searchNyaa(firstWord);
        candidates = filterByEpisode(results, true);
        best = pickBest(candidates);
        if (best) return best;
    }

    // Pass 4: relax sub requirement
    for (const q of [romajiKeywords, englishKeywords]) {
        await new Promise((r) => setTimeout(r, 200));
        results = await searchNyaa(q);
        candidates = filterByEpisode(results, false).filter((r) => r.seeders > 0);
        best = pickBest(candidates);
        if (best) return best;
    }

    return null;
}

// ─── Batch pack search (try to find a batch/complete pack first) ─────────────

async function findBatchPack(
    romajiTitle: string,
    englishTitle: string,
    totalEpisodes: number,
    preferDub: boolean
): Promise<NyaaResult | null> {
    const romajiKeywords = extractSearchKeywords(romajiTitle);
    const englishKeywords = extractSearchKeywords(englishTitle);

    const batchSuffixes = ["batch", "complete", `01-${String(totalEpisodes).padStart(2, "0")}`];

    for (const keywords of [romajiKeywords, englishKeywords]) {
        for (const suffix of batchSuffixes) {
            const query = `${keywords} ${suffix}`;
            const results = await searchNyaa(query);

            // Filter for batch packs — must not match single episode pattern tightly
            const batches = results.filter((r) => {
                const lower = r.title.toLowerCase();
                // Must have some batch indicator
                if (!lower.includes("batch") && !lower.includes("complete") && !/ \d{2}-\d{2} /.test(r.title)) {
                    return false;
                }
                if (preferDub && !isDualAudioOrDub(r.title)) return false;
                if (!preferDub && !hasSubs(r.title)) return false;
                return r.seeders > 0;
            });

            if (batches.length > 0) {
                // Prefer ToonsHub
                const toonshub = batches.filter((r) => isFromUploader(r.title, "ToonsHub"));
                if (toonshub.length > 0) {
                    toonshub.sort((a, b) => b.seeders - a.seeders);
                    return toonshub[0];
                }
                batches.sort((a, b) => b.seeders - a.seeders);
                return batches[0];
            }

            await new Promise((r) => setTimeout(r, 200));
        }
    }

    return null;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { title, romaji, english, totalEpisodes, releaseType } = await req.json();

        if (!title || totalEpisodes < 1) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        const resolvedRomaji = romaji || title;
        const resolvedEnglish = english || title;
        const preferDub = releaseType === "DUB";

        console.log(`\n[Download All] "${title}" — ${totalEpisodes} episodes, preferDub=${preferDub}`);

        // ── Step 1: Try to find a batch pack first ───────────────────────────
        console.log("  [Batch] Searching for batch/complete pack...");
        const batchResult = await findBatchPack(resolvedRomaji, resolvedEnglish, totalEpisodes, preferDub);

        if (batchResult) {
            console.log(`  ✓ Found batch: "${batchResult.title}" (${batchResult.seeders} seeds)`);

            // Download the batch torrent
            const dlRes = await fetch(batchResult.torrentUrl);
            if (dlRes.ok) {
                const buffer = await dlRes.arrayBuffer();
                const cleanTitle = title.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();

                // Return the torrent directly (no zip needed for batch)
                return new Response(buffer, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/x-bittorrent",
                        "Content-Disposition": `attachment; filename="${cleanTitle} - Batch.torrent"`,
                        "X-Download-Type": "batch",
                    },
                });
            }
        }

        console.log("  [Batch] No batch found, searching individual episodes...");

        // ── Step 2: Search for each episode individually ─────────────────────
        const zip = new JSZip();
        let foundCount = 0;
        const notFound: number[] = [];

        for (let ep = 1; ep <= totalEpisodes; ep++) {
            console.log(`  [Ep ${ep}/${totalEpisodes}] Searching...`);

            const best = await findBestTorrentForEpisode(
                resolvedRomaji,
                resolvedEnglish,
                ep,
                preferDub
            );

            if (!best) {
                console.warn(`  ✗ Ep ${ep}: not found`);
                notFound.push(ep);
                continue;
            }

            console.log(`  ✓ Ep ${ep}: "${best.title}" (${best.seeders} seeds)`);

            // Download the torrent file
            const dlRes = await fetch(best.torrentUrl);
            if (!dlRes.ok) {
                console.warn(`  ✗ Ep ${ep}: download failed`);
                notFound.push(ep);
                continue;
            }

            const buffer = await dlRes.arrayBuffer();
            const cleanTitle = title.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
            const fileName = `${cleanTitle} - ${String(ep).padStart(2, "0")}.torrent`;
            zip.file(fileName, buffer);
            foundCount++;

            // Rate limit between episodes
            await new Promise((r) => setTimeout(r, 300));
        }

        if (foundCount === 0) {
            return NextResponse.json(
                { error: "No torrents found for any episode." },
                { status: 404 }
            );
        }

        console.log(`  ✓ Done: ${foundCount}/${totalEpisodes} found, ${notFound.length} missing: [${notFound.join(", ")}]`);

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
        const cleanTitle = title.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();

        return new Response(zipBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${cleanTitle} - Episodes 1-${totalEpisodes}.zip"`,
                "X-Download-Type": "individual",
                "X-Found-Count": String(foundCount),
                "X-Total-Episodes": String(totalEpisodes),
                "X-Missing-Episodes": notFound.join(","),
            },
        });
    } catch (err: any) {
        console.error("[Download All] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
