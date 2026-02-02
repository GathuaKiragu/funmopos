import axios, { AxiosError } from 'axios';
import { redis, isRedisEnabled } from '@/lib/redis';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.FOOTBALL_HIGHLIGHTS_API_KEY;
const BASE_URL = 'https://soccer.highlightly.net';

// ============================================================================
// TYPE DEFINITIONS (Based on OpenAPI Schema)
// ============================================================================

export interface TeamStatistics {
    leagueId: number;
    season: number;
    leagueName: string;
    total: {
        games: { played: number; wins: number; loses: number; draws: number };
        goals: { scored: number; received: number };
    };
    home: {
        games: { played: number; wins: number; loses: number; draws: number };
        goals: { scored: number; received: number };
    };
    away: {
        games: { played: number; wins: number; loses: number; draws: number };
        goals: { scored: number; received: number };
    };
}

export interface MatchDetails {
    id: number;
    round: string;
    date: string;
    venue?: {
        name: string;
        city: string;
    };
    weather?: {
        temperature: string;
        condition: string;
    };
    referee?: {
        name: string;
    };
    statistics?: {
        possession: { home: number; away: number };
        shots: { home: number; away: number };
        shotsOnTarget: { home: number; away: number };
    };
    events?: MatchEvent[];
    news?: string[];
}

export interface MatchEvent {
    type: 'Goal' | 'Yellow Card' | 'Red Card' | 'Substitution' | 'VAR Goal Confirmed' | 'VAR Goal Cancelled' | 'Penalty' | 'Missed Penalty';
    time: number;
    team: 'home' | 'away';
    player?: string;
    detail?: string;
}

export interface StandingsData {
    league: {
        id: number;
        name: string;
        season: number;
    };
    standings: Array<{
        position: number;
        team: {
            id: number;
            name: string;
            logo: string;
        };
        points: number;
        played: number;
        won: number;
        draw: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        form: string; // e.g., "WWDLW"
    }>;
}

export interface PlayerBoxScore {
    team: {
        id: number;
        name: string;
    };
    players: Array<{
        id: number;
        name: string;
        position: string;
        minutesPlayed: number;
        rating?: number;
        statistics: {
            goalsScored?: number;
            assists?: number;
            shotsTotal?: number;
            shotsOnTarget?: number;
            expectedGoals?: number; // xG
            expectedAssists?: number; // xA
            expectedGoalsOnTarget?: number; // xGOT
            passingAccuracy?: number;
            duelsWon?: number;
            tackles?: number;
        };
    }>;
}

export interface OddsData {
    matchId: number;
    bookmaker: {
        id: number;
        name: string;
    };
    markets: {
        fullTimeResult?: {
            home: number;
            draw: number;
            away: number;
        };
        totalGoals?: {
            over25: number;
            under25: number;
        };
        bothTeamsToScore?: {
            yes: number;
            no: number;
        };
    };
}

export interface Match {
    id: number;
    date: string;
    homeTeam: {
        id: number;
        name: string;
        logo: string;
    };
    awayTeam: {
        id: number;
        name: string;
        logo: string;
    };
    league: {
        id: number;
        name: string;
        season: number;
    };
    state: {
        description: string;
        score?: {
            current: string;
        };
    };
}

export interface LineupData {
    team: {
        id: number;
        name: string;
        logo: string;
        colors?: any;
    };
    coach: {
        id: number;
        name: string;
        photo?: string;
    };
    formation: string;
    startXI: {
        player: {
            id: number;
            name: string;
            number: number;
            pos: string;
            grid: string | null;
        };
    }[];
    substitutes: {
        player: {
            id: number;
            name: string;
            number: number;
            pos: string;
            grid: string | null;
        };
    }[];
}

// ============================================================================
// API CLIENT
// ============================================================================

class FootballHighlightsAPI {
    private rateLimitRemaining: number | null = null;
    private rateLimitTotal: number | null = null;

    /**
     * Make authenticated request to Football Highlights API
     */
    private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
        if (!API_KEY) {
            console.warn('[Football Highlights API] API key not configured. Skipping request.');
            return null;
        }

        try {
            console.log(`[Football Highlights API] 🔄 Request: ${endpoint}`, { params });

            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                params,
                headers: {
                    'x-rapidapi-key': API_KEY,
                },
                timeout: 10000,
            });

            // Track rate limits
            this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-requests-remaining'] || '0');
            this.rateLimitTotal = parseInt(response.headers['x-ratelimit-requests-limit'] || '0');

            // Log response details
            console.log(`[Football Highlights API] ✅ Response: ${endpoint}`, {
                status: response.status,
                statusText: response.statusText,
                rateLimitRemaining: this.rateLimitRemaining,
                rateLimitTotal: this.rateLimitTotal,
                dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
                dataLength: Array.isArray(response.data) ? response.data.length :
                    response.data?.data?.length || 'N/A',
            });

            // Log sample data (first item if array)
            if (Array.isArray(response.data) && response.data.length > 0) {
                console.log(`[Football Highlights API] 📊 Sample Data:`, response.data[0]);
            } else if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                console.log(`[Football Highlights API] 📊 Sample Data:`, response.data.data[0]);
            } else if (response.data && typeof response.data === 'object') {
                console.log(`[Football Highlights API] 📊 Response Data:`, response.data);
            }

            if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 10) {
                console.warn(`[Football Highlights API] ⚠️ Low rate limit: ${this.rateLimitRemaining}/${this.rateLimitTotal} remaining`);
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                if (axiosError.response?.status === 429) {
                    console.error('[Football Highlights API] ❌ Rate limit exceeded');
                } else if (axiosError.response?.status === 400) {
                    console.error('[Football Highlights API] ❌ Bad request:', {
                        endpoint,
                        params,
                        response: axiosError.response.data
                    });
                } else if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
                    console.error('[Football Highlights API] ❌ Authentication failed - check API key');
                } else {
                    console.error('[Football Highlights API] ❌ Request failed:', {
                        endpoint,
                        status: axiosError.response?.status,
                        statusText: axiosError.response?.statusText,
                        message: axiosError.message
                    });
                }
            } else {
                console.error('[Football Highlights API] ❌ Unexpected error:', error);
            }
            return null;
        }
    }

    /**
     * Get team statistics for a specific team
     * @param teamId Team ID
     * @param fromDate Date in YYYY-MM-DD format
     * @param timezone Optional timezone (default: Etc/UTC)
     */
    async getTeamStatistics(teamId: number, fromDate: string, timezone: string = 'Etc/UTC', forceRefresh: boolean = false): Promise<TeamStatistics[] | null> {
        const cacheKey = `fh:team-stats:${teamId}:${fromDate}`;

        // Try cache first
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<TeamStatistics[]>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for team stats: ${teamId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const data = await this.request<TeamStatistics[]>(`/teams/statistics/${teamId}`, {
            fromDate,
            timezone,
        });

        // Cache for 24 hours (stats update after matches)
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 86400 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get detailed match information
     * @param matchId Match ID
     */
    async getMatchDetails(matchId: number, forceRefresh: boolean = false): Promise<MatchDetails | null> {
        const cacheKey = `fh:match-details:${matchId}`;

        // Try cache first (10 min TTL for live matches)
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<MatchDetails>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for match details: ${matchId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const response = await this.request<{ data: MatchDetails[] }>(`/matches/${matchId}`);
        const data = response?.data?.[0] || null;

        // Cache for 10 minutes
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 600 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get league standings
     * @param leagueId League ID
     * @param season Season year (e.g., 2024)
     */
    async getStandings(leagueId: number, season: number, forceRefresh: boolean = false): Promise<StandingsData | null> {
        const cacheKey = `fh:standings:${leagueId}:${season}`;

        // Try cache first (1 hour TTL)
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<StandingsData>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for standings: ${leagueId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const data = await this.request<StandingsData>('/standings', {
            leagueId,
            season,
        });

        // Cache for 1 hour
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 3600 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get player box scores for a match (includes xG metrics)
     * @param matchId Match ID
     */
    async getPlayerBoxScore(matchId: number, forceRefresh: boolean = false): Promise<PlayerBoxScore[] | null> {
        const cacheKey = `fh:box-score:${matchId}`;

        // Try cache first (5 min TTL for live matches)
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<PlayerBoxScore[]>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for box score: ${matchId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const data = await this.request<PlayerBoxScore[]>(`/box-score/${matchId}`);

        // Cache for 5 minutes
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 300 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get odds for a match
     * @param matchId Match ID
     * @param oddsType 'prematch' or 'live'
     */
    async getOdds(matchId: number, oddsType: 'prematch' | 'live' = 'prematch', forceRefresh: boolean = false): Promise<OddsData[] | null> {
        const cacheKey = `fh:odds:${matchId}:${oddsType}`;

        // Try cache first (30 min for prematch, 5 min for live)
        const cacheTTL = oddsType === 'prematch' ? 1800 : 300;
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<OddsData[]>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for odds: ${matchId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const response = await this.request<{ data: OddsData[] }>('/odds', {
            matchId,
            oddsType,
        });
        const data = response?.data || null;

        // Cache
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: cacheTTL });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get matches for a specific date
     * @param date Date in YYYY-MM-DD format
     * @param leagueId Optional league filter
     */
    async getMatches(date: string, leagueId?: number, forceRefresh: boolean = false): Promise<Match[] | null> {
        const cacheKey = `fh:matches:${date}:${leagueId || 'all'}`;

        // Try cache first (10 min TTL)
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<Match[]>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for matches: ${date}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const params: Record<string, any> = { date };
        if (leagueId) params.leagueId = leagueId;

        const response = await this.request<{ data: Match[] }>('/matches', params);
        const data = response?.data || null;

        // Cache for 10 minutes
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 600 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get lineups for a match
     * @param matchId Match ID
     */
    async getLineups(matchId: number, forceRefresh: boolean = false): Promise<LineupData[] | null> {
        const cacheKey = `fh:lineups:${matchId}`;

        // Try cache first (15 min TTL)
        if (!forceRefresh && redis) {
            try {
                const cached = await redis?.get<LineupData[]>(cacheKey);
                if (cached) {
                    console.log(`[Football Highlights API] Cache hit for lineups: ${matchId}`);
                    return cached;
                }
            } catch (err) {
                console.error('[Football Highlights API] Redis read error:', err);
            }
        }

        // Fetch from API
        const response = await this.request<{ response: LineupData[] }>('/lineups', { matchId });
        const data = response?.response || null;

        // Cache for 15 minutes
        if (data && redis) {
            try {
                await redis?.set(cacheKey, data, { ex: 900 });
            } catch (err) {
                console.error('[Football Highlights API] Redis write error:', err);
            }
        }

        return data;
    }

    /**
     * Get current rate limit status
     */
    getRateLimitStatus(): { remaining: number | null; total: number | null } {
        return {
            remaining: this.rateLimitRemaining,
            total: this.rateLimitTotal,
        };
    }
}

// Export singleton instance
export const footballHighlightsAPI = new FootballHighlightsAPI();

/**
 * Get head-to-head matches between two teams
 * @param team1Id First team ID
 * @param team2Id Second team ID
 * @param limit Maximum number of matches to return (default: 10)
 * @returns Array of historical matches between the two teams
 */
export async function getH2HMatches(
    team1Id: number,
    team2Id: number,
    limit: number = 10,
    forceRefresh: boolean = false
): Promise<Match[]> {
    const cacheKey = `h2h:${Math.min(team1Id, team2Id)}-${Math.max(team1Id, team2Id)}:${limit}`;

    // Try cache first (24 hour TTL for H2H data)
    if (!forceRefresh && redis) {
        try {
            const cached = await redis?.get<Match[]>(cacheKey);
            if (cached) {
                console.log(`[H2H] Cache hit for teams ${team1Id} vs ${team2Id}`);
                return cached;
            }
        } catch (err) {
            console.error('[H2H] Redis read error:', err);
        }
    }

    console.log(`[H2H] Fetching historical matches for teams ${team1Id} vs ${team2Id}`);

    // Fetch matches from the last year
    const matches: Match[] = [];
    const today = new Date();

    // Strategy: Check recent matches first (more likely to find H2H)
    // Go back 1 year, checking key dates (weekends, mid-week)
    const daysToCheck = 365; // 1 year back
    const checkInterval = 7; // Check every week

    for (let i = 0; i < daysToCheck && matches.length < limit; i += checkInterval) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        try {
            const dayMatches = await footballHighlightsAPI.getMatches(dateStr);

            if (dayMatches) {
                // Filter for matches between these two teams
                const h2hMatches = dayMatches.filter(match =>
                    (match.homeTeam.id === team1Id && match.awayTeam.id === team2Id) ||
                    (match.homeTeam.id === team2Id && match.awayTeam.id === team1Id)
                );

                matches.push(...h2hMatches);
            }
        } catch (error) {
            // Silently continue on errors (date might not have data)
        }

        // Small delay every 10 requests to avoid rate limiting
        if (i % (checkInterval * 10) === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Sort by date (most recent first) and limit
    const sortedMatches = matches
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);

    // Cache for 24 hours
    if (sortedMatches.length > 0 && redis) {
        try {
            await redis?.set(cacheKey, sortedMatches, { ex: 86400 });
        } catch (err) {
            console.error('[H2H] Redis write error:', err);
        }
    }

    console.log(`[H2H] Found ${sortedMatches.length} historical matches`);
    return sortedMatches;
}
