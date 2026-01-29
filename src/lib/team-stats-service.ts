import { db } from './firebase';
import { redis, isRedisEnabled } from './redis';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import axios from 'axios';
import { TeamStatistics } from './types/stats';

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const BASE_URL = `https://${API_HOST}`;

// Priority leagues (top 6)
const PRIORITY_LEAGUES = [39, 140, 135, 78, 61, 2]; // PL, La Liga, Serie A, Bundesliga, Ligue 1, CL

/**
 * Get team statistics with multi-level caching
 * 1. Redis (1 hour TTL)
 * 2. Firestore (24 hour freshness)
 * 3. API-Football (fallback)
 */
export async function getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number = 2024
): Promise<TeamStatistics | null> {
    try {
        // 1. Check Redis cache (fastest)
        const redisKey = `team_stats:${teamId}:${season}`;
        if (isRedisEnabled()) {
            try {
                const cached = await redis.get<TeamStatistics>(redisKey);
                if (cached) {
                    console.log(`[Team Stats] Redis hit for team ${teamId}`);
                    return cached;
                }
            } catch (err) {
                console.warn('[Team Stats] Redis read error:', err);
            }
        }

        // 2. Check Firestore cache (24 hour freshness)
        const docRef = doc(db, 'team_statistics', `${teamId}-${season}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as TeamStatistics & { lastUpdated: any };
            const lastUpdated = data.lastUpdated?.toDate?.() || new Date(data.lastUpdated);
            const age = Date.now() - lastUpdated.getTime();

            // If data is less than 24 hours old, use it
            if (age < 24 * 60 * 60 * 1000) {
                console.log(`[Team Stats] Firestore hit for team ${teamId} (age: ${Math.round(age / 3600000)}h)`);

                // Backfill Redis
                if (isRedisEnabled()) {
                    try {
                        await redis.set(redisKey, data, { ex: 3600 }); // 1 hour
                    } catch (err) {
                        console.warn('[Team Stats] Redis write error:', err);
                    }
                }

                return data;
            }

            console.log(`[Team Stats] Firestore data stale for team ${teamId} (age: ${Math.round(age / 3600000)}h)`);
        }

        // 3. Fetch from API (only if high priority league or critical)
        if (!PRIORITY_LEAGUES.includes(leagueId)) {
            console.log(`[Team Stats] Skipping API fetch for low-priority league ${leagueId}`);
            return null;
        }

        console.log(`[Team Stats] Fetching from API for team ${teamId}, league ${leagueId}, season ${season}`);

        if (!API_KEY) {
            console.error('[Team Stats] Missing API_FOOTBALL_KEY');
            return null;
        }

        const response = await axios.get(`${BASE_URL}/teams/statistics`, {
            params: {
                team: teamId,
                league: leagueId,
                season: season
            },
            headers: {
                'x-apisports-key': API_KEY,
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY
            }
        });

        if (!response.data?.response) {
            console.error('[Team Stats] Invalid API response:', response.data);
            return null;
        }

        const stats = parseTeamStats(response.data.response, teamId, leagueId, season);

        // Save to Firestore
        try {
            await setDoc(docRef, {
                ...stats,
                lastUpdated: new Date()
            });
            console.log(`[Team Stats] Saved to Firestore for team ${teamId}`);
        } catch (err) {
            console.error('[Team Stats] Firestore write error:', err);
        }

        // Save to Redis
        if (isRedisEnabled()) {
            try {
                await redis.set(redisKey, stats, { ex: 3600 }); // 1 hour
            } catch (err) {
                console.warn('[Team Stats] Redis write error:', err);
            }
        }

        return stats;

    } catch (error: any) {
        console.error(`[Team Stats] Error fetching stats for team ${teamId}:`, error.message);
        return null;
    }
}

/**
 * Parse API-Football team statistics response into our schema
 */
function parseTeamStats(
    apiResponse: any,
    teamId: number,
    leagueId: number,
    season: number
): TeamStatistics {
    const fixtures = apiResponse.fixtures || {};
    const goals = apiResponse.goals?.for || {};
    const goalsAgainst = apiResponse.goals?.against || {};

    // Calculate form from last 5 matches
    const form = apiResponse.form || '';
    const formArray = form.split('').slice(0, 5);

    // Parse last 5 matches (if available)
    const last5Matches = formArray.map((result: string, idx: number) => ({
        date: '', // API doesn't provide this in statistics endpoint
        opponent: '',
        homeAway: 'H' as 'H' | 'A', // Would need fixtures endpoint to determine
        result: result as 'W' | 'D' | 'L',
        goalsFor: 0,
        goalsAgainst: 0
    }));

    const totalPlayed = fixtures.played?.total || 0;
    const homeGoalsFor = goals.total?.home || 0;
    const awayGoalsFor = goals.total?.away || 0;
    const homeGoalsAgainst = goalsAgainst.total?.home || 0;
    const awayGoalsAgainst = goalsAgainst.total?.away || 0;

    return {
        teamId,
        teamName: apiResponse.team?.name || '',
        leagueId,
        season,
        lastUpdated: new Date(),

        // Overall stats
        matchesPlayed: totalPlayed,
        wins: fixtures.wins?.total || 0,
        draws: fixtures.draws?.total || 0,
        losses: fixtures.loses?.total || 0,
        goalsFor: goals.total?.total || 0,
        goalsAgainst: goalsAgainst.total?.total || 0,

        // Home/Away split
        home: {
            played: fixtures.played?.home || 0,
            wins: fixtures.wins?.home || 0,
            draws: fixtures.draws?.home || 0,
            losses: fixtures.loses?.home || 0,
            goalsFor: homeGoalsFor,
            goalsAgainst: homeGoalsAgainst
        },
        away: {
            played: fixtures.played?.away || 0,
            wins: fixtures.wins?.away || 0,
            draws: fixtures.draws?.away || 0,
            losses: fixtures.loses?.away || 0,
            goalsFor: awayGoalsFor,
            goalsAgainst: awayGoalsAgainst
        },

        // Form
        form: formArray.join(''),
        last5Matches,

        // Advanced stats
        avgGoalsScored: totalPlayed > 0 ? (goals.total?.total || 0) / totalPlayed : 0,
        avgGoalsConceded: totalPlayed > 0 ? (goalsAgainst.total?.total || 0) / totalPlayed : 0,
        cleanSheets: apiResponse.clean_sheet?.total || 0,
        failedToScore: apiResponse.failed_to_score?.total || 0
    };
}

/**
 * Batch fetch team statistics for multiple teams
 * Useful for pre-fetching tomorrow's matches
 */
export async function batchGetTeamStatistics(
    teams: { teamId: number; leagueId: number; season?: number }[]
): Promise<Map<number, TeamStatistics | null>> {
    const results = new Map<number, TeamStatistics | null>();

    // Fetch in parallel but respect rate limits
    const promises = teams.map(async ({ teamId, leagueId, season = 2024 }) => {
        const stats = await getTeamStatistics(teamId, leagueId, season);
        results.set(teamId, stats);
    });

    await Promise.all(promises);

    return results;
}
