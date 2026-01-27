import axios from 'axios';
import * as cheerio from 'cheerio';
import { Fixture, Sport } from './api-football';
import { format } from 'date-fns';

/**
 * Scrapes fixture data from a high-reliability public source.
 * This is used when the primary API lacks coverage for specific dates/leagues.
 */
export async function scrapeFixtures(date: Date): Promise<Fixture[]> {
    try {
        const formattedDate = format(date, "yyyy-MM-dd");
        console.log(`[Scraper] Fetching data for ${formattedDate}...`);

        // Target: Besoccer (Excellent semantic HTML for parsing)
        const url = `https://www.besoccer.com/livescore/${formattedDate}`;

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            timeout: 5000
        });

        const $ = cheerio.load(data);
        const fixtures: Fixture[] = [];

        // Besoccer Structure: .panel-title (League) -> .panel-body (Matches)
        $('.panel-title').each((i, leagueEl) => {
            const leagueName = $(leagueEl).find('a').first().text().trim();
            const leagueId = $(leagueEl).attr('id') || `league-${i}`;
            const leagueFlag = $(leagueEl).find('img').attr('src') || "";

            // The matches are in the NEXT sibling .panel-body
            const matchContainer = $(leagueEl).next('.panel-body');

            matchContainer.find('.match-link').each((j, matchEl) => {
                try {
                    const statusText = $(matchEl).find('.status').text().trim();
                    const homeName = $(matchEl).find('.team-name.home').text().trim();
                    const awayName = $(matchEl).find('.team-name.away').text().trim();
                    const homeScore = $(matchEl).find('.score .home').text().trim();
                    const awayScore = $(matchEl).find('.score .away').text().trim();
                    const matchId = $(matchEl).attr('href')?.split('/').pop() || `${leagueId}-${j}`;

                    if (!homeName || !awayName) return;

                    // Parse Status
                    let shortStatus = "NS";
                    if (statusText.includes("'") || statusText.toLowerCase() === 'live') shortStatus = "LIVE";
                    if (statusText === 'FT' || statusText === 'Fin') shortStatus = "FT";
                    if (statusText === 'P-P' || statusText === 'Post') shortStatus = "PST";
                    if (statusText.includes(':')) shortStatus = "NS"; // Time

                    // Normalize Goals
                    const homeGoals = homeScore && !isNaN(parseInt(homeScore)) ? parseInt(homeScore) : null;
                    const awayGoals = awayScore && !isNaN(parseInt(awayScore)) ? parseInt(awayScore) : null;

                    fixtures.push({
                        id: parseInt(matchId) || Math.floor(Math.random() * 1000000),
                        sport: "football",
                        date: new Date(formattedDate).toISOString(), // Approximate, time is in statusText usually
                        league: {
                            name: leagueName,
                            logo: "",
                            flag: leagueFlag
                        },
                        homeTeam: { name: homeName, logo: "" }, // Logos require extra fetch usually
                        awayTeam: { name: awayName, logo: "" },
                        status: {
                            short: shortStatus,
                            elapsed: statusText.includes("'") ? parseInt(statusText) : null
                        },
                        goals: {
                            home: homeGoals,
                            away: awayGoals
                        },
                        prediction: null
                    });
                } catch (e) {
                    // Ignore malformed rows
                }
            });
        });

        console.log(`[Scraper] Successfully parsed ${fixtures.length} matches.`);
        return fixtures;

    } catch (error) {
        console.error("Scraper Error:", error);
        return [];
    }
}
