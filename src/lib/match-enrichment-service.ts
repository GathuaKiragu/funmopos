import { Fixture } from './api-football';
import { footballHighlightsAPI, TeamStatistics, MatchDetails, StandingsData, PlayerBoxScore, OddsData } from './football-highlights-api';
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
 * Note: This is a simplified version. In production, you'd query historical matches
 * from the Football Highlights API's /matches endpoint with team filters.
 */
async function calculateH2HRecord(
    homeTeamId: number,
    awayTeamId: number
): Promise<EnrichedData['h2hRecord'] | null> {
    // TODO: Implement historical match fetching
    // For now, return null to indicate no H2H data available
    // This would require querying /matches endpoint with homeTeamId and awayTeamId filters
    // across multiple dates to build historical record
    return null;
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich a single fixture with data from Football Highlights API
 * @param fixture The fixture to enrich
 * @returns Enriched fixture with additional data
 */
export async function enrichFixture(fixture: Fixture): Promise<EnrichedFixture> {
    console.log(`[Match Enrichment] Enriching fixture ${fixture.id}: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`);

    // Prepare date for API calls (30 days back for stats)
    const fromDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    try {
        // Fetch all data in parallel for performance
        const [
            homeStats,
            awayStats,
            matchDetails,
            // standings, // Commented out for now - requires leagueId mapping
            boxScores,
            odds,
        ] = await Promise.all([
            // Team statistics (if we have team IDs - currently we only have names)
            // footballHighlightsAPI.getTeamStatistics(fixture.homeTeam.id, fromDate),
            // footballHighlightsAPI.getTeamStatistics(fixture.awayTeam.id, fromDate),
            Promise.resolve(null), // Placeholder until we have team ID mapping
            Promise.resolve(null), // Placeholder until we have team ID mapping

            // Match details
            footballHighlightsAPI.getMatchDetails(fixture.id),

            // Standings (requires league ID mapping)
            // footballHighlightsAPI.getStandings(fixture.league.id, 2024),

            // Player box scores (for xG metrics)
            footballHighlightsAPI.getPlayerBoxScore(fixture.id),

            // Odds
            footballHighlightsAPI.getOdds(fixture.id, 'prematch'),
        ]);

        // Calculate xG metrics from box scores
        const xgMetrics = boxScores ? calculateXGMetrics(boxScores) : undefined;

        // Extract odds
        const oddsData = extractOdds(odds);

        // Build enriched data object
        const enrichedData: EnrichedData = {
            teamStats: {
                home: homeStats?.[0] || null,
                away: awayStats?.[0] || null,
            },
            matchDetails: matchDetails || undefined,
            xgMetrics: xgMetrics || undefined,
            odds: oddsData,
            // h2hRecord: await calculateH2HRecord(fixture.homeTeam.id, fixture.awayTeam.id),
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
    maxConcurrent: number = 5
): Promise<EnrichedFixture[]> {
    console.log(`[Match Enrichment] Enriching ${fixtures.length} fixtures with max concurrency ${maxConcurrent}`);

    // Process in batches to avoid overwhelming the API
    const results: EnrichedFixture[] = [];

    for (let i = 0; i < fixtures.length; i += maxConcurrent) {
        const batch = fixtures.slice(i, i + maxConcurrent);
        console.log(`[Match Enrichment] Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(fixtures.length / maxConcurrent)}`);

        const enrichedBatch = await Promise.all(
            batch.map(fixture => enrichFixture(fixture))
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

    // H2H Record
    if (enrichedData.h2hRecord) {
        const h2h = enrichedData.h2hRecord;
        parts.push(`**Head-to-Head (Last ${h2h.totalMatches} meetings):**`);
        parts.push(`- Home ${h2h.homeWins}W, Draw ${h2h.draws}, Away ${h2h.awayWins}W`);
        parts.push(`- Avg Goals: Home ${h2h.avgGoalsHome.toFixed(1)}, Away ${h2h.avgGoalsAway.toFixed(1)}`);
    }

    return parts.join('\n');
}
