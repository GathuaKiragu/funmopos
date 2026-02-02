import { Fixture, saveOpeningOdds } from './api-football';
import { footballHighlightsAPI, TeamStatistics, MatchDetails, StandingsData, PlayerBoxScore, OddsData, LineupData } from './football-highlights-api';
import { analyzeMotivation, MotivationAnalysis } from './motivation-analysis';
import { format, subDays } from 'date-fns';

// ============================================================================
// ENRICHED DATA TYPES
// ============================================================================

export interface EnrichedData {
    teamStats?: {
        home: TeamStatistics | null;
        away: TeamStatistics | null;
    };
    matchDetails?: MatchDetails | null;
    standings?: StandingsData | null;
    xgMetrics?: {
        homeXG: number;
        awayXG: number;
        homeXGA: number; // xG Against
        awayXGA: number;
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
    lineups?: {
        home: LineupData | null;
        away: LineupData | null;
        confirmed: boolean;
    };
    droppingOdds?: {
        isDropping: boolean;
        dropPercentage: number;
        bookmakerTrend: string; // e.g. "Home Odds Dropping"
    };
    motivation?: MotivationAnalysis;
}

export interface EnrichedFixture extends Fixture {
    enrichedData?: EnrichedData;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate xG metrics from recent player box scores
 */
function calculateXGMetrics(boxScores: PlayerBoxScore[]): {
    homeXG: number;
    awayXG: number;
    homeXGA: number;
    awayXGA: number;
} | null {
    if (!boxScores || boxScores.length === 0) return null;

    const homeTeam = boxScores[0];
    const awayTeam = boxScores[1];

    const sumXG = (team: PlayerBoxScore) => {
        return team.players.reduce((sum, player) => {
            return sum + (player.statistics.expectedGoals || 0);
        }, 0);
    };

    return {
        homeXG: sumXG(homeTeam),
        awayXG: sumXG(awayTeam),
        homeXGA: sumXG(awayTeam), // Away team's xG is home team's xGA
        awayXGA: sumXG(homeTeam),
    };
}

/**
 * Extract odds from API response
 */
function extractOdds(oddsData: OddsData[] | null): EnrichedData['odds'] {
    if (!oddsData || oddsData.length === 0) {
        return {
            homeWin: null,
            draw: null,
            awayWin: null,
            over25: null,
            under25: null,
            bttsYes: null,
        };
    }

    // Use first bookmaker's odds (could be enhanced to average multiple bookmakers)
    const firstBookmaker = oddsData[0];
    const markets = firstBookmaker.markets;

    return {
        homeWin: markets.fullTimeResult?.home || null,
        draw: markets.fullTimeResult?.draw || null,
        awayWin: markets.fullTimeResult?.away || null,
        over25: markets.totalGoals?.over25 || null,
        under25: markets.totalGoals?.under25 || null,
        bttsYes: markets.bothTeamsToScore?.yes || null,
    };
}

/**
 * Calculate head-to-head record from historical matches
 */
async function calculateH2HRecord(
    homeTeamId: number,
    awayTeamId: number,
    forceRefresh: boolean = false
): Promise<EnrichedData['h2hRecord'] | null> {
    try {
        // Import the H2H function
        const { getH2HMatches } = await import('./football-highlights-api');

        // Fetch last 10 H2H matches
        const h2hMatches = await getH2HMatches(homeTeamId, awayTeamId, 10, forceRefresh);

        if (!h2hMatches || h2hMatches.length === 0) {
            console.log(`[H2H] No historical matches found between teams ${homeTeamId} and ${awayTeamId}`);
            return null;
        }

        console.log(`[H2H] Analyzing ${h2hMatches.length} historical matches`);

        let homeWins = 0;
        let draws = 0;
        let awayWins = 0;
        let totalGoalsHome = 0;
        let totalGoalsAway = 0;
        let validMatches = 0;

        for (const match of h2hMatches) {
            // Only count finished matches with scores
            if (!match.state?.score?.current) continue;

            const [scoreHome, scoreAway] = match.state.score.current.split('-').map(Number);
            if (isNaN(scoreHome) || isNaN(scoreAway)) continue;

            validMatches++;

            // Determine which team was home/away in this historical match
            const wasHomeTeamHome = match.homeTeam.id === homeTeamId;

            if (wasHomeTeamHome) {
                // Current home team was home in this match
                totalGoalsHome += scoreHome;
                totalGoalsAway += scoreAway;

                if (scoreHome > scoreAway) homeWins++;
                else if (scoreHome < scoreAway) awayWins++;
                else draws++;
            } else {
                // Current home team was away in this match
                totalGoalsHome += scoreAway;
                totalGoalsAway += scoreHome;

                if (scoreAway > scoreHome) homeWins++;
                else if (scoreAway < scoreHome) awayWins++;
                else draws++;
            }
        }

        if (validMatches === 0) {
            return null;
        }

        return {
            homeWins,
            draws,
            awayWins,
            totalMatches: validMatches,
            avgGoalsHome: totalGoalsHome / validMatches,
            avgGoalsAway: totalGoalsAway / validMatches,
        };
    } catch (error) {
        console.error('[H2H] Error calculating H2H record:', error);
        return null;
    }
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich a single fixture with data from Football Highlights API
 * @param fixture The fixture to enrich
 * @returns Enriched fixture with additional data
 */
export async function enrichFixture(fixture: Fixture, forceRefresh: boolean = false): Promise<EnrichedFixture> {
    console.log(`[Match Enrichment] Enriching fixture ${fixture.id}: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`);

    // Prepare date for API calls (30 days back for stats)
    const fromDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    try {
        // Step 0: Resolve Football Highlights API Match ID
        const dateKey = fixture.date.split('T')[0];
        const fhMatches = await footballHighlightsAPI.getMatches(dateKey, undefined, forceRefresh);

        let fhMatchId = null;
        let fhHomeTeamId = null;
        let fhAwayTeamId = null;

        if (fhMatches) {
            const found = fhMatches.find(m =>
                (m.homeTeam.name.toLowerCase().includes(fixture.homeTeam.name.toLowerCase()) || fixture.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase())) &&
                (m.awayTeam.name.toLowerCase().includes(fixture.awayTeam.name.toLowerCase()) || fixture.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase()))
            );

            if (found) {
                fhMatchId = found.id;
                fhHomeTeamId = found.homeTeam.id;
                fhAwayTeamId = found.awayTeam.id;
                console.log(`[Match Enrichment] Mapped API-Sports ID ${fixture.id} to Highlightly ID ${fhMatchId}`);
            } else {
                console.warn(`[Match Enrichment] Could not map fixture ${fixture.homeTeam.name} vs ${fixture.awayTeam.name} to Highlightly API`);
            }
        }

        if (!fhMatchId || !fhHomeTeamId || !fhAwayTeamId) {
            console.log(`[Match Enrichment] Skipping enrichment for ${fixture.id} due to mapping failure`);
            return fixture;
        }

        const [
            homeStats,
            awayStats,
            matchDetails,
            boxScores,
            odds,
            rawLineups
        ] = await Promise.all([
            // Team statistics using Highlightly IDs
            footballHighlightsAPI.getTeamStatistics(fhHomeTeamId, fromDate, 'Etc/UTC', forceRefresh),
            footballHighlightsAPI.getTeamStatistics(fhAwayTeamId, fromDate, 'Etc/UTC', forceRefresh),

            // Match details
            footballHighlightsAPI.getMatchDetails(fhMatchId, forceRefresh),

            // Player box scores 
            footballHighlightsAPI.getPlayerBoxScore(fhMatchId, forceRefresh),

            // Odds
            footballHighlightsAPI.getOdds(fhMatchId, 'prematch', forceRefresh),

            // Lineups (1 hour window)
            (new Date(fixture.date).getTime() - new Date().getTime()) < 3600000
                ? footballHighlightsAPI.getLineups(fhMatchId, forceRefresh)
                : Promise.resolve(null),
        ]);

        // Calculate xG metrics from box scores
        const xgMetrics = boxScores ? calculateXGMetrics(boxScores) : undefined;

        // Extract odds
        const oddsData = extractOdds(odds);

        // Smart Money Tracking (Dropping Odds)
        let droppingOdds = undefined;
        if (oddsData && oddsData.homeWin && oddsData.draw && oddsData.awayWin) {
            // 1. Try to save as opening odds (if first time seen)
            await saveOpeningOdds(fixture.id, {
                home: oddsData.homeWin,
                draw: oddsData.draw,
                away: oddsData.awayWin
            });

            // 2. Check for drop if opening odds exist
            if (fixture.openingOdds) {
                const open = fixture.openingOdds;
                const current = oddsData;

                // Calculate drops
                // If Home odds dropped by > 10%
                if (current.homeWin && current.awayWin) {
                    const homeDrop = ((open.home - current.homeWin) / open.home) * 100;
                    const awayDrop = ((open.away - current.awayWin) / open.away) * 100;

                    if (homeDrop > 10) {
                        droppingOdds = {
                            isDropping: true,
                            dropPercentage: homeDrop,
                            bookmakerTrend: "Home Odds CRASHING (Smart Money)"
                        };
                    } else if (awayDrop > 10) {
                        droppingOdds = {
                            isDropping: true,
                            dropPercentage: awayDrop,
                            bookmakerTrend: "Away Odds CRASHING (Smart Money)"
                        };
                    }
                }
            }
        }

        // Build enriched data object
        const enrichedData: EnrichedData = {
            teamStats: {
                home: homeStats?.[0] || null,
                away: awayStats?.[0] || null,
            },
            matchDetails: matchDetails || undefined,
            xgMetrics: xgMetrics || undefined,
            odds: oddsData,
            droppingOdds,
            lineups: rawLineups && rawLineups.length === 2 ? {
                home: rawLineups[0],
                away: rawLineups[1],
                confirmed: true
            } : undefined,
            h2hRecord: (await calculateH2HRecord(fhHomeTeamId, fhAwayTeamId, forceRefresh)) || undefined,
        };

        console.log(`[Match Enrichment] Successfully enriched fixture ${fixture.id}`);

        return {
            ...fixture,
            enrichedData,
        };
    } catch (error) {
        console.error(`[Match Enrichment] Error enriching fixture ${fixture.id}:`, error);
        // Return original fixture on error (graceful degradation)
        return fixture;
    }
}

/**
 * Enrich multiple fixtures in parallel
 * @param fixtures Array of fixtures to enrich
 * @param maxConcurrent Maximum number of concurrent enrichment operations (default: 5)
 * @returns Array of enriched fixtures
 */
export async function enrichFixtures(
    fixtures: Fixture[],
    maxConcurrent: number = 5,
    forceRefresh: boolean = false
): Promise<EnrichedFixture[]> {
    console.log(`[Match Enrichment] Enriching ${fixtures.length} fixtures with max concurrency ${maxConcurrent}`);

    // Process in batches to avoid overwhelming the API
    const results: EnrichedFixture[] = [];

    for (let i = 0; i < fixtures.length; i += maxConcurrent) {
        const batch = fixtures.slice(i, i + maxConcurrent);
        console.log(`[Match Enrichment] Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(fixtures.length / maxConcurrent)}`);

        const enrichedBatch = await Promise.all(
            batch.map(fixture => enrichFixture(fixture, forceRefresh))
        );

        results.push(...enrichedBatch);
    }

    console.log(`[Match Enrichment] Completed enrichment of ${results.length} fixtures`);
    return results;
}

/**
 * Build enriched context string for AI analysis
 * @param enrichedData Enriched data from Football Highlights API
 * @returns Formatted string for AI prompt
 */
export function buildEnrichedContext(enrichedData: EnrichedData | undefined): string {
    if (!enrichedData) {
        return 'No enriched data available.';
    }

    const parts: string[] = [];

    // Team Statistics
    if (enrichedData.teamStats?.home && enrichedData.teamStats?.away) {
        const homeStats = enrichedData.teamStats.home;
        const awayStats = enrichedData.teamStats.away;

        parts.push(`**Team Statistics (Last 30 days):**`);
        parts.push(`- Home: ${homeStats.total.games.wins}W-${homeStats.total.games.draws}D-${homeStats.total.games.loses}L, ${homeStats.total.goals.scored} goals scored, ${homeStats.total.goals.received} conceded`);
        parts.push(`- Away: ${awayStats.total.games.wins}W-${awayStats.total.games.draws}D-${awayStats.total.games.loses}L, ${awayStats.total.goals.scored} goals scored, ${awayStats.total.goals.received} conceded`);
    }

    // xG Metrics
    if (enrichedData.xgMetrics) {
        parts.push(`**Expected Goals (xG):**`);
        parts.push(`- Home xG: ${enrichedData.xgMetrics.homeXG.toFixed(2)}, xGA: ${enrichedData.xgMetrics.homeXGA.toFixed(2)}`);
        parts.push(`- Away xG: ${enrichedData.xgMetrics.awayXG.toFixed(2)}, xGA: ${enrichedData.xgMetrics.awayXGA.toFixed(2)}`);
    }

    // Match Details
    if (enrichedData.matchDetails) {
        const details = enrichedData.matchDetails;
        if (details.venue) {
            parts.push(`**Venue:** ${details.venue.name}, ${details.venue.city}`);
        }
        if (details.weather) {
            parts.push(`**Weather:** ${details.weather.condition}, ${details.weather.temperature}`);
        }
        if (details.referee) {
            parts.push(`**Referee:** ${details.referee.name}`);
        }
    }

    // Odds
    if (enrichedData.odds && enrichedData.odds.homeWin) {
        parts.push(`**Market Odds:**`);
        parts.push(`- Full Time: Home ${enrichedData.odds.homeWin}, Draw ${enrichedData.odds.draw}, Away ${enrichedData.odds.awayWin}`);
        if (enrichedData.odds.over25) {
            parts.push(`- Total Goals: Over 2.5 @ ${enrichedData.odds.over25}, Under 2.5 @ ${enrichedData.odds.under25}`);
        }
        if (enrichedData.odds.bttsYes) {
            parts.push(`- BTTS: Yes @ ${enrichedData.odds.bttsYes}`);
        }
    }

    // Smart Money / Dropping Odds
    if (enrichedData.droppingOdds && enrichedData.droppingOdds.isDropping) {
        parts.push(`**SMART MONEY ALERT:** ${enrichedData.droppingOdds.bookmakerTrend} (${enrichedData.droppingOdds.dropPercentage.toFixed(1)}% drop). This is a strong signal.`);
    }

    // H2H Record
    if (enrichedData.h2hRecord) {
        const h2h = enrichedData.h2hRecord;
        parts.push(`**Head-to-Head (Last ${h2h.totalMatches} meetings):**`);
        parts.push(`- Home ${h2h.homeWins}W, Draw ${h2h.draws}, Away ${h2h.awayWins}W`);
        parts.push(`- Avg Goals: Home ${h2h.avgGoalsHome.toFixed(1)}, Away ${h2h.avgGoalsAway.toFixed(1)}`);
    }

    // Lineups
    if (enrichedData.lineups && enrichedData.lineups.confirmed) {
        const home = enrichedData.lineups.home;
        const away = enrichedData.lineups.away;
        if (home && away) {
            parts.push(`**Official Lineups Confirmed:**`);
            parts.push(`- Home Formation: ${home.formation}`);
            parts.push(`- Away Formation: ${away.formation}`);
            // Could add key players check here if we had a list of stars
        }
    }

    return parts.join('\n');
}
