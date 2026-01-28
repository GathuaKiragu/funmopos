
import axios from "axios";
import * as cheerio from "cheerio";
import { format } from "date-fns";
import { SourceIdentity, SourceReport } from "./reliability/types";

/**
 * Scrapes fixture data from Besoccer as a SourceReport.
 */
export async function scrapeBesoccer(date: Date): Promise<SourceReport[]> {
    try {
        const formattedDate = format(date, "yyyy-MM-dd");
        const url = `https://www.besoccer.com/livescore/${formattedDate}`;

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const reports: SourceReport[] = [];

        $('.match-link').each((i, el) => {
            const $el = $(el);
            const homeTeam = $el.find('.team-name').first().text().trim();
            const awayTeam = $el.find('.team-name').last().text().trim();
            const scoreText = $el.find('.marker').text().trim();
            const statusText = $el.find('.status').text().trim() || "NS";

            // Extract score if it exists
            const scores = scoreText.includes('-') ? scoreText.split('-') : [];
            const homeScore = scores.length === 2 ? parseInt(scores[0]) : undefined;
            const awayScore = scores.length === 2 ? parseInt(scores[1]) : undefined;

            if (homeTeam && awayTeam) {
                reports.push({
                    source: SourceIdentity.BESOCCER,
                    timestamp: new Date(),
                    homeTeam,
                    awayTeam,
                    kickoff: date,
                    status: mapBesoccerStatus(statusText),
                    scoreHome: homeScore,
                    scoreAway: awayScore
                });
            }
        });

        return reports;
    } catch (error) {
        console.error("Besoccer Scraper Error:", error);
        return [];
    }
}

function mapBesoccerStatus(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('final') || s.includes('ft')) return 'FT';
    if (s.includes('postp') || s.includes('pst')) return 'PST';
    if (s.includes('live') || s.includes("'")) return 'LIVE';
    return 'NS';
}
