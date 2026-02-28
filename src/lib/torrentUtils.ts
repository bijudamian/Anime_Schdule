/**
 * Utility functions for generating unique torrent search queries 
 * and extracting exact episode numbers from RSS feed titles.
 */

/**
 * Creates a unique abbreviation from a Romaji title by progressively adding words
 * until the abbreviation is strictly unique across the active database.
 */
export function generateUniqueAbbreviation(targetRomaji: string, allRomaji: string[]): string {
    const cleanWord = (s: string) => s.replace(/[^\w\s]/g, '').trim();
    const targetClean = cleanWord(targetRomaji);
    if (!targetClean) return targetRomaji; // fallback

    const targetWords = targetClean.split(/\s+/).filter(Boolean);

    for (let i = 1; i <= targetWords.length; i++) {
        const candidate = targetWords.slice(0, i).join(" ").toLowerCase();

        let conflictCount = 0;
        for (const r of allRomaji) {
            const rClean = cleanWord(r);
            if (rClean.toLowerCase() === targetClean.toLowerCase()) continue; // same show

            const rWords = rClean.split(/\s+/).filter(Boolean);
            const rPrefix = rWords.slice(0, i).join(" ").toLowerCase();

            if (rPrefix === candidate) {
                conflictCount++;
            }
        }

        if (conflictCount === 0) {
            return targetWords.slice(0, i).join(" ");
        }
    }

    return targetWords.join(" ");
}

/**
 * Parses an RSS title and uses Regex to extract the episode number.
 * Handles patterns like "S01E08", " - 08", "EP08", "Episode 8".
 */
export function extractEpisodeNumber(rssTitle: string): number | null {
    // Math pattern prioritizing explicit Season/Episode markers or hyphen spacing
    // e.g. "S01E08", "S1E8", "EP08", "Ep. 8", " - 08 "
    const regex = /(?:S\d+\s*E|EP?|Episode|Ep\.|-\s*)\s*0*(\d+)\b/i;
    const match = rssTitle.match(regex);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }

    // Fallback: looking for lone numbers right before brackets or tags 
    // e.g. "[Group] Anime Title 08 [1080p]"
    const fallbackMatch = rssTitle.match(/\s0*(\d+)\s(?:\[|\()/);
    if (fallbackMatch && fallbackMatch[1]) {
        return parseInt(fallbackMatch[1], 10);
    }

    return null;
}
