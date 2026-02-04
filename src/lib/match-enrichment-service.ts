import {
    Fixture,
    saveOpeningOdds,
    fetchMatchStats,
    fetchMatchLineups,
    fetchInjuries,
    fetchOdds,
    fetchPlayerStats,
    TeamMatchStats,
    TeamLineup,
    Injury,
    MarketOdds,
    PlayerStats
} from './api-football';
import { analyzeMotivation, MotivationAnalysis } from './motivation-analysis';
import { format, subDays } from 'date-fns';

// ============================================================================
// ENRICHED DATA TYPES
// ============================================================================

export interface EnrichedData {
    teamStats?: {
        home: TeamMatchStats | null;
        away: TeamMatchStats | null;
    };
    lineups?: {
        home: TeamLineup | null;
        away: TeamLineup | null;
    };
    injuries?: {
        home: Injury[];
        away: Injury[];
    };
    odds?: {
        homeWin: number | null;
        draw: number | null;
        awayWin: number | null;
        over25: number | null;
        under25: number | null;
        bttsYes: number | null;
    };
    h2hRecord?: {
        homeWins: number;
        draws: number;
        awayWins: number;
        totalMatches: number;
        avgGoalsHome: number;
        avgGoalsAway: number;
    };
    droppingOdds?: {
        isDropping: boolean;
        dropPercentage: number;
        bookmakerTrend: string; // e.g. "Home Odds Dropping"
    };
    motivation?: MotivationAnalysis;
    playerStats?: {
        home: PlayerStats[];
        away: PlayerStats[];
    };
}

export interface EnrichedFixture extends Fixture {
    enrichedData?: EnrichedData;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract odds from API-Sports response
 */
function extractOdds(oddsData: MarketOdds[] | null): NonNullable<EnrichedData['odds']> {
    if (!oddsData || oddsData.length === 0) {
        return {
            homeWin: null, draw: null, awayWin: null, over25: null, under25: null, bttsYes: null
        };
    }

    // Usually we filter by a specific bookmaker before this function, but just in case
    const bookmaker = oddsData[0];
    const bets = bookmaker.bets;

    // Helper to find odd value
    const findOdd = (betName: string, valueName: string) => {
        const bet = bets.find(b => b.name === betName);
        if (!bet) return null;
        const val = bet.values.find(v => v.value === valueName);
        return val ? parseFloat(val.odd) : null;
    };

    return {
        homeWin: findOdd("Match Winner", "Home"),
        draw: findOdd("Match Winner", "Draw"),
        awayWin: findOdd("Match Winner", "Away"),
        over25: findOdd("Goals Over/Under", "Over 2.5"),
        under25: findOdd("Goals Over/Under", "Under 2.5"),
        bttsYes: findOdd("Both Teams To Score", "Yes")
    };
}

/**
 * Calculate head-to-head record from historical matches
 * (We still need a method for H2H, presumably reusing the one from highlightly or moving it to api-football too? 
 * The task said "update enrichment service", but I didn't verify H2H method in api-football yet.
 * For now, I will omit the H2H call or assume we can import it if it was moved. 
 * Actually, the plan didn't explicitly move H2H. 
 * I'll comment it out for now to ensure we don't break build, or keep using the old one if imported? 
 * The old one was in football-highlights-api which I am trying to remove.
 * I will temporarily remove H2H from enrichment until I add it to api-football properly in a follow up or if I can just use fetching H2H from API sports.
 * API Sports has /fixtures/headtohead. I should probably add that too. 
 * For this step, I will leave H2H undefined to avoid errors, and add it next.)
 */

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich a single fixture with data from API-Sports (Pro)
 * @param fixture The fixture to enrich
 * @returns Enriched fixture with additional data
 */
export async function enrichFixture(fixture: Fixture, forceRefresh: boolean = false): Promise<EnrichedFixture> {
    console.log(`[Match Enrichment] Enriching fixture ${fixture.id}: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`);

    try {
        // Parallel Fetching of Pro Data
        const [
            statsData,
            lineupsData,
            injuriesData,
            oddsData,
            // playerStatsData // fetching player stats can be heavy, maybe optional?
        ] = await Promise.all([
            fetchMatchStats(fixture.id, forceRefresh),
            fetchMatchLineups(fixture.id, forceRefresh),
            fetchInjuries(fixture.id, forceRefresh),
            fetchOdds(fixture.id, forceRefresh),
            // fetchPlayerStats(fixture.id, forceRefresh) // Optional
        ]);

        // Process Stats
        let teamStats = undefined;
        if (statsData && statsData.length >= 2) {
            // API sports returns array of 2 teams
            // We need to map them to home/away correctly
            const homeStats = statsData.find(s => s.team.id === fixture.homeTeam.id || s.team.name === fixture.homeTeam.name);
            const awayStats = statsData.find(s => s.team.id === fixture.awayTeam.id || s.team.name === fixture.awayTeam.name);

            // Fallback if IDs don't match (sometimes API uses different internal IDs? usually fixture.homeTeam.id matches)
            // If we can't match by ID, take index 0 and 1
            const finalHome = homeStats || statsData[0];
            const finalAway = awayStats || statsData[1];

            teamStats = { home: finalHome, away: finalAway };
        }

        // Process Lineups
        let lineups = undefined;
        if (lineupsData && lineupsData.length === 2) {
            const homeLineup = lineupsData.find(l => l.team.name === fixture.homeTeam.name) || lineupsData[0];
            const awayLineup = lineupsData.find(l => l.team.name === fixture.awayTeam.name) || lineupsData[1];
            lineups = { home: homeLineup, away: awayLineup };
        }

        // Process Injuries
        let injuries = undefined;
        if (injuriesData && injuriesData.length > 0) {
            injuries = {
                home: injuriesData.filter(i => i.team.name === fixture.homeTeam.name),
                away: injuriesData.filter(i => i.team.name === fixture.awayTeam.name)
            };
        }

        // Process Odds
        const enrichedOdds = extractOdds(oddsData);

        // Smart Money / Dropping Odds
        let droppingOdds = undefined;
        if (enrichedOdds.homeWin && enrichedOdds.awayWin && fixture.openingOdds) {
            const open = fixture.openingOdds;
            const current = enrichedOdds;

            if (current.homeWin && current.awayWin) {
                const homeDrop = ((open.home - current.homeWin) / open.home) * 100;
                const awayDrop = ((open.away - current.awayWin) / open.away) * 100;

                if (homeDrop > 10) {
                    droppingOdds = { isDropping: true, dropPercentage: homeDrop, bookmakerTrend: "Home Odds CRASHING" };
                } else if (awayDrop > 10) {
                    droppingOdds = { isDropping: true, dropPercentage: awayDrop, bookmakerTrend: "Away Odds CRASHING" };
                }
            }
        }

        // Build enriched data object
        const enrichedData: EnrichedData = {
            teamStats,
            lineups,
            injuries,
            odds: enrichedOdds,
            droppingOdds,
            // h2hRecord: ... (TODO: Add H2H fetch)
        };

        return {
            ...fixture,
            enrichedData,
        };

    } catch (error) {
        console.error(`[Match Enrichment] Error enriching fixture ${fixture.id}:`, error);
        return fixture;
    }
}

/**
 * Enrich multiple fixtures in parallel
 */
export async function enrichFixtures(
    fixtures: Fixture[],
    maxConcurrent: number = 5,
    forceRefresh: boolean = false
): Promise<EnrichedFixture[]> {
    console.log(`[Match Enrichment] Enriching ${fixtures.length} fixtures...`);

    // Simple batching
    const results: EnrichedFixture[] = [];
    for (let i = 0; i < fixtures.length; i += maxConcurrent) {
        const batch = fixtures.slice(i, i + maxConcurrent);
        const enrichedBatch = await Promise.all(
            batch.map(fixture => enrichFixture(fixture, forceRefresh))
        );
        results.push(...enrichedBatch);
    }
    return results;
}

/**
 * Build enriched context string for AI analysis
 */
export function buildEnrichedContext(enrichedData: EnrichedData | undefined): string {
    if (!enrichedData) return 'No enriched data available.';

    const parts: string[] = [];

    // Team Stats
    if (enrichedData.teamStats) {
        const { home, away } = enrichedData.teamStats;
        if (home && away) {
            // Helper to find stat value
            const getVal = (stats: any[], type: string) => stats.find(s => s.type === type)?.value || 0;

            parts.push(`**Detailed Match Stats (Recent):**`);
            parts.push(`- Home: Shots on Goal ${getVal(home.statistics, 'Shots on Goal')}, Possession ${getVal(home.statistics, 'Ball Possession')}, xG ${getVal(home.statistics, 'expected_goals') || 'N/A'}`);
            parts.push(`- Away: Shots on Goal ${getVal(away.statistics, 'Shots on Goal')}, Possession ${getVal(away.statistics, 'Ball Possession')}, xG ${getVal(away.statistics, 'expected_goals') || 'N/A'}`);
        }
    }

    // Injuries (Critical!)
    if (enrichedData.injuries) {
        const { home, away } = enrichedData.injuries;
        if (home.length > 0 || away.length > 0) {
            parts.push(`**INJURY REPORT (CRITICAL):**`);
            if (home.length > 0) parts.push(`- Home Missing: ${home.map(i => `${i.player.name} (${i.player.reason})`).join(', ')}`);
            if (away.length > 0) parts.push(`- Away Missing: ${away.map(i => `${i.player.name} (${i.player.reason})`).join(', ')}`);
        }
    }

    // Lineups
    if (enrichedData.lineups) {
        const { home, away } = enrichedData.lineups;
        if (home && away) {
            parts.push(`**Confimed Lineups:**`);
            parts.push(`- Home (${home.formation}): ${home.startXI.map(p => p.player.name).join(', ')}`);
            parts.push(`- Away (${away.formation}): ${away.startXI.map(p => p.player.name).join(', ')}`);
        }
    }

    // Odds
    if (enrichedData.odds && enrichedData.odds.homeWin) {
        parts.push(`**Market Odds:** Home ${enrichedData.odds.homeWin} | Draw ${enrichedData.odds.draw} | Away ${enrichedData.odds.awayWin}`);
        if (enrichedData.droppingOdds) {
            parts.push(`**MARKET MOVEMENT:** ${enrichedData.droppingOdds.bookmakerTrend} (-${enrichedData.droppingOdds.dropPercentage.toFixed(1)}%)`);
        }
    }

    return parts.join('\n');
}
