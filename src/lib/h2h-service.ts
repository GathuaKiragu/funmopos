import { db } from './firebase';
import { redis, isRedisEnabled } from './redis';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import axios from 'axios';
import { HeadToHead } from './types/stats';

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const BASE_URL = `https://${API_HOST}`;

/**
 * Get head-to-head statistics with multi-level caching
 * H2H data changes infrequently, so we cache for 7 days
 */
export async function getH2HData(
    team1Id: number,
    team2Id: number
): Promise<HeadToHead | null> {
    try {
        // Create consistent ID (sorted to avoid duplicates)
        const [smallerId, largerId] = [team1Id, team2Id].sort((a, b) => a - b);
        const h2hId = `${smallerId}-${largerId}`;

        // 1. Check Redis cache (7 day TTL)
        const redisKey = `h2h:${h2hId}`;
        if (isRedisEnabled()) {
            try {
                const cached = await redis.get<HeadToHead>(redisKey);
                if (cached) {
                    console.log(`[H2H] Redis hit for ${h2hId}`);
                    return cached;
                }
            } catch (err) {
                console.warn('[H2H] Redis read error:', err);
            }
        }

        // 2. Check Firestore cache (7 day freshness)
        const docRef = doc(db, 'head_to_head', h2hId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as HeadToHead & { lastUpdated: any };
            const lastUpdated = data.lastUpdated?.toDate?.() || new Date(data.lastUpdated);
            const age = Date.now() - lastUpdated.getTime();

            // If data is less than 7 days old, use it
            if (age < 7 * 24 * 60 * 60 * 1000) {
                console.log(`[H2H] Firestore hit for ${h2hId} (age: ${Math.round(age / 86400000)}d)`);

                // Backfill Redis
                if (isRedisEnabled()) {
                    try {
                        await redis.set(redisKey, data, { ex: 7 * 24 * 60 * 60 }); // 7 days
                    } catch (err) {
                        console.warn('[H2H] Redis write error:', err);
                    }
                }

                return data;
            }

            console.log(`[H2H] Firestore data stale for ${h2hId} (age: ${Math.round(age / 86400000)}d)`);
        }

        // 3. Fetch from API
        console.log(`[H2H] Fetching from API for teams ${team1Id} vs ${team2Id}`);

        if (!API_KEY) {
            console.error('[H2H] Missing API_FOOTBALL_KEY');
            return null;
        }

        const response = await axios.get(`${BASE_URL}/fixtures/headtohead`, {
            params: {
                h2h: `${team1Id}-${team2Id}`,
                last: 10 // Get last 10 meetings
            },
            headers: {
                'x-apisports-key': API_KEY,
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY
            }
        });

        if (!response.data?.response || !Array.isArray(response.data.response)) {
            console.error('[H2H] Invalid API response:', response.data);
            return null;
        }

        const h2hData = parseH2HData(response.data.response, team1Id, team2Id);

        // Save to Firestore
        try {
            await setDoc(docRef, {
                ...h2hData,
                lastUpdated: new Date()
            });
            console.log(`[H2H] Saved to Firestore for ${h2hId}`);
        } catch (err) {
            console.error('[H2H] Firestore write error:', err);
        }

        // Save to Redis (7 day TTL)
        if (isRedisEnabled()) {
            try {
                await redis.set(redisKey, h2hData, { ex: 7 * 24 * 60 * 60 });
            } catch (err) {
                console.warn('[H2H] Redis write error:', err);
            }
        }

        return h2hData;

    } catch (error: any) {
        console.error(`[H2H] Error fetching H2H for teams ${team1Id} vs ${team2Id}:`, error.message);
        return null;
    }
}

/**
 * Parse API-Football H2H response into our schema
 */
function parseH2HData(
    fixtures: any[],
    team1Id: number,
    team2Id: number
): HeadToHead {
    const [smallerId, largerId] = [team1Id, team2Id].sort((a, b) => a - b);

    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;
    let totalGoals = 0;

    const last5Meetings = fixtures.slice(0, 5).map((fixture: any) => {
        const homeId = fixture.teams?.home?.id;
        const awayId = fixture.teams?.away?.id;
        const homeScore = fixture.goals?.home || 0;
        const awayScore = fixture.goals?.away || 0;

        totalGoals += homeScore + awayScore;

        // Determine winner
        let winner: number | null = null;
        if (homeScore > awayScore) {
            winner = homeId;
            if (homeId === team1Id) team1Wins++;
            else team2Wins++;
        } else if (awayScore > homeScore) {
            winner = awayId;
            if (awayId === team1Id) team1Wins++;
            else team2Wins++;
        } else {
            draws++;
        }

        return {
            date: fixture.fixture?.date || '',
            homeTeamId: homeId,
            awayTeamId: awayId,
            homeScore,
            awayScore,
            winner
        };
    });

    // Get team names from first fixture
    const firstFixture = fixtures[0];
    const team1Name = firstFixture?.teams?.home?.id === team1Id
        ? firstFixture?.teams?.home?.name
        : firstFixture?.teams?.away?.name;
    const team2Name = firstFixture?.teams?.home?.id === team2Id
        ? firstFixture?.teams?.home?.name
        : firstFixture?.teams?.away?.name;

    return {
        id: `${smallerId}-${largerId}`,
        team1Id,
        team2Id,
        team1Name: team1Name || `Team ${team1Id}`,
        team2Name: team2Name || `Team ${team2Id}`,
        lastUpdated: new Date(),

        totalMeetings: fixtures.length,
        team1Wins,
        draws,
        team2Wins,

        last5Meetings,

        avgGoalsPerGame: last5Meetings.length > 0 ? totalGoals / last5Meetings.length : 0
    };
}

/**
 * Batch fetch H2H data for multiple matchups
 */
export async function batchGetH2HData(
    matchups: { team1Id: number; team2Id: number }[]
): Promise<Map<string, HeadToHead | null>> {
    const results = new Map<string, HeadToHead | null>();

    const promises = matchups.map(async ({ team1Id, team2Id }) => {
        const [smallerId, largerId] = [team1Id, team2Id].sort((a, b) => a - b);
        const h2hId = `${smallerId}-${largerId}`;
        const h2h = await getH2HData(team1Id, team2Id);
        results.set(h2hId, h2h);
    });

    await Promise.all(promises);

    return results;
}
