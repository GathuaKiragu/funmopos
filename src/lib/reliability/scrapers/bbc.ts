
import axios from "axios";
import * as cheerio from "cheerio";
import { SourceIdentity, SourceReport } from "../types";

export async function scrapeBBCSport(date: Date): Promise<SourceReport[]> {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const url = `https://www.bbc.com/sport/football/scores-fixtures/${dateStr}`;

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const reports: SourceReport[] = [];

        $('.qa-match-block').each((i, el) => {
            const matches = $(el).find('.sp-c-fixture');
            matches.each((j, m) => {
                const $m = $(m);
                const homeTeam = $m.find('.sp-c-fixture__team-name--home .sp-c-fixture__team-name-trunc').text().trim();
                const awayTeam = $m.find('.sp-c-fixture__team-name--away .sp-c-fixture__team-name-trunc').text().trim();
                const status = $m.find('.sp-c-fixture__status').text().trim();

                const homeScore = $m.find('.sp-c-fixture__number--home').text().trim();
                const awayScore = $m.find('.sp-c-fixture__number--away').text().trim();

                if (homeTeam && awayTeam) {
                    reports.push({
                        source: SourceIdentity.BBC_SPORT,
                        timestamp: new Date(),
                        homeTeam,
                        awayTeam,
                        kickoff: date, // Date only for now
                        status: mapBBCStatus(status),
                        scoreHome: homeScore ? parseInt(homeScore) : undefined,
                        scoreAway: awayScore ? parseInt(awayScore) : undefined
                    });
                }
            });
        });

        return reports;
    } catch (e) {
        console.error("BBC Scraper Error", e);
        return [];
    }
}

function mapBBCStatus(status: string): string {
    if (status.includes('FT')) return 'FT';
    if (status.includes('PST')) return 'PST';
    if (status.match(/\d+:\d+/)) return 'NS';
    return 'LIVE';
}
