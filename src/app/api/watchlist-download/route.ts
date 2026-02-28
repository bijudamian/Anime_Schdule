import { NextResponse } from "next/server";
import JSZip from "jszip";
import { extractEpisodeNumber } from "@/lib/torrentUtils";

// Simple fallback regex to unescape CDATA or XML entities
function stripCdata(str: string) {
    let s = str.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
    // Replace XML entities
    s = s.replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'");
    return s;
}

export async function POST(req: Request) {
    try {
        const { items } = await req.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "Invalid items array" }, { status: 400 });
        }

        const zip = new JSZip();
        let foundCount = 0;

        for (const item of items) {
            const { query, expectedEpisode, originalTitle } = item;
            // Nyaa url: category Anime-English translated (c=1_2), filter NO REMAKES (f=0)
            const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(query)}&c=1_2&f=0`;

            try {
                const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
                const xmlText = await response.text();

                // Match all <item> tags
                const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/gi);
                if (itemMatches) {
                    for (const itemContent of itemMatches) {
                        const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/i);
                        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);

                        if (titleMatch && linkMatch) {
                            const titleRaw = titleMatch[1].trim();
                            const title = stripCdata(titleRaw);
                            const torrentUrl = linkMatch[1].trim();

                            // Validate Episode
                            const extractedEpisode = extractEpisodeNumber(title);

                            if (extractedEpisode !== null && extractedEpisode === expectedEpisode) {
                                if (torrentUrl && torrentUrl.startsWith("http")) {
                                    const dlRes = await fetch(torrentUrl);
                                    if (dlRes.ok) {
                                        const buffer = await dlRes.arrayBuffer();
                                        const cleanTitle = originalTitle.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, ' ').trim();
                                        const fileName = `${cleanTitle} - ${expectedEpisode}.torrent`;

                                        zip.file(fileName, buffer);
                                        foundCount++;
                                        break; // Done with this show for today
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch/parse Nyaa for ${query}:`, e);
            }

            // Being polite, wait 500ms between searches
            await new Promise(res => setTimeout(res, 500));
        }

        if (foundCount === 0) {
            return NextResponse.json({ error: "No torrents found." }, { status: 404 });
        }

        // Generate the ZIP as an ArrayBuffer, natively compatible with Response body
        const zipFile = await zip.generateAsync({ type: "arraybuffer" });

        return new Response(zipFile, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": 'attachment; filename="watchlist_torrents.zip"',
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
