import { format, subDays, addDays, isPast, addHours } from "date-fns";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    query,
    where,
    limit,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import axios from "axios";
import { redis, isRedisEnabled } from "@/lib/redis";

export type Sport = "football" | "basketball";

export interface Fixture {
    id: number;
    sport: Sport;
    league: {
        name: string;
        logo: string;
        flag: string;
    };
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
    date: string;
    status: {
        short: string;
        elapsed?: number | null;
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    openingOdds?: {
        home: number;
        draw: number;
        away: number;
        timestamp: number;
    };
    prediction?: {
        picked: string;
        confidence: number;
        reasoning: string | string[]; // Backwards compatible
        analysis?: string; // New: Detailed comprehensive analysis
        type: "result" | "goals" | "score";
        isRisky: boolean;
        requiresTier: "free" | "basic" | "standard" | "vip";
        probabilities?: {
            home: number;
            draw: number;
            away: number;
        };
        h2h?: string;
    } | null;
    // New Pro Data Points
    stats?: {
        home: TeamMatchStats;
        away: TeamMatchStats;
    };
    lineups?: {
        home: TeamLineup;
        away: TeamLineup;
    };
    injuries?: Injury[];
    playerStats?: {
        home: PlayerStats[];
        away: PlayerStats[];
    };
    latestOdds?: MarketOdds[];
    socialPosted?: boolean;
    socialPostedAt?: number;
}

// --- Pro API Interfaces ---

export interface TeamMatchStats {
    team: { id: number; name: string; logo: string };
    statistics: { type: string; value: any }[];
}

export interface TeamLineup {
    team: { id: number; name: string; logo: string };
    formation: string;
    startXI: { player: { id: number; name: string; number: number; pos: string; grid: string } }[];
    substitutes: { player: { id: number; name: string; number: number; pos: string; grid: string } }[];
    coach: { id: number; name: string; photo?: string };
}

export interface Injury {
    player: { id: number; name: string; photo: string; type: string; reason: string };
    team: { id: number; name: string; logo: string };
    fixture: { id: number; date: string; timestamp: number; timezone: string };
}

export interface PlayerStats {
    player: { id: number; name: string; photo: string };
    statistics: {
        games: { minutes: number; position: string; rating: string; captain: boolean; substitute: boolean };
        shots: { total: number; on: number };
        goals: { total: number; assists: number; saves: number };
        passes: { total: number; key: number; accuracy: number };
        tackles: { total: number; blocks: number; interceptions: number };
        duels: { total: number; won: number };
        dribbles: { attempts: number; success: number };
        fouls: { drawn: number; committed: number };
        cards: { yellow: number; red: number };
        penalty: { won: number; commited: number; scored: number; missed: number; saved: number };
    }[];
}

export interface MarketOdds {
    id: number; // Bookmaker ID
    name: string; // Bookmaker Name
    bets: {
        id: number;
        name: string;
        values: { value: string; odd: string }[];
    }[];
}

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = `https://${API_HOST}`;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Competition mapping: Premier League (PL), Championship (ELC), La Liga (PD), Serie A (SA), Bundesliga (BL1), Ligue 1 (FL1), Eredivisie (DED), Primeira Liga (PPL)
// Expanded: CL (Champions League), EL (Europa League), EC (Euro), WC (World Cup), CLI (Libertadores), BSA (Brazil Serie A)
const COMPETITIONS = ["PL", "ELC", "PD", "SA", "BL1", "FL1", "DED", "PPL", "CL", "EL", "EC", "WC", "CLI", "BSA"];

// CORE LEAGUES for automatic priority analysis
const CORE_LEAGUE_NAMES = [
    "Premier League", "Championship", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
    "Eredivisie", "Primeira Liga", "Champions League", "Europa League", "Euro",
    "World Cup", "Copa Libertadores", "Serie A (Brazil)", "Major League Soccer",
    "FA Cup", "Copa del Rey", "DFB Pokal", "Coppa Italia"
];

export const isCoreLeague = (leagueName: string) => {
    return CORE_LEAGUE_NAMES.some(core => leagueName.toLowerCase().includes(core.toLowerCase()));
};

// --- QUOTA & BILLING TRACKING ---
// Simple in-memory global state to handle 402/429 errors gracefully
let QUOTA_STATUS = {
    deepseek_billing_empty: false,
    api_sports_rate_limited: false,
    last_402_at: 0,
    last_429_at: 0,
    api_sports_remaining: -1, // -1 means unknown
    api_sports_limit: -1,
    api_sports_used: 0
};

const checkQuotas = () => {
    const now = Date.now();
    // Reset status after 1 hour of "timeout"
    if (QUOTA_STATUS.deepseek_billing_empty && (now - QUOTA_STATUS.last_402_at > 3600000)) {
        QUOTA_STATUS.deepseek_billing_empty = false;
        console.log("[Quota] DeepSeek billing cooldown expired.");
    }
    if (QUOTA_STATUS.api_sports_rate_limited && (now - QUOTA_STATUS.last_429_at > 3600000)) {
        QUOTA_STATUS.api_sports_rate_limited = false;
        console.log("[Quota] API-Sports rate-limit cooldown expired.");
    }
    return QUOTA_STATUS;
};

export const getQuotaStatus = () => checkQuotas();

/**
 * Returns the current date/time adjusted to Nairobi (EAT, UTC+3).
 */
export const getNairobiNow = () => {
    const now = new Date();
    // In many environments, the system clock is UTC. We add 3 hours.
    // If the system clock is already EAT, this might double-offset.
    // Better practice: use the UTC time and calculate offset.
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utcTime + (3 * 3600000));
};

// Fetch from Football-Data.org
export const fetchFromApi = async (targetDate: Date, sport: Sport = "football"): Promise<Fixture[]> => {
    if (sport !== "football") {
        console.warn(`Sport ${sport} not yet supported in real-time fetch`);
        return [];
    }

    if (!API_KEY) {
        console.error("Missing API_FOOTBALL_KEY");
        return [];
    }

    const targetDateKey = format(targetDate, "yyyy-MM-dd");

    try {
        const validHeaders: any = {
            'x-apisports-key': API_KEY
        };

        // Only add RapidAPI headers if actually using RapidAPI host
        if (API_HOST?.includes('rapidapi')) {
            validHeaders['x-rapidapi-host'] = API_HOST;
            validHeaders['x-rapidapi-key'] = API_KEY;
        }

        const response = await axios.get(`${BASE_URL}/fixtures`, {
            params: {
                date: targetDateKey,
            },
            headers: validHeaders
        });

        const rawFixtures = response.data.response;
        if (!rawFixtures || !Array.isArray(rawFixtures)) {
            console.error("Invalid API Response", response.data);
            return [];
        }

        console.log(`[API Response] Received ${rawFixtures.length} total matches from API-Sports for ${targetDateKey}`);

        const mappedFixtures = rawFixtures.map((item: any) => ({
            id: item.fixture.id,
            sport: "football" as Sport,
            league: {
                name: item.league.name,
                logo: item.league.logo,
                flag: item.league.flag || ""
            },
            homeTeam: {
                id: item.teams.home.id,
                name: item.teams.home.name,
                logo: item.teams.home.logo
            },
            awayTeam: {
                id: item.teams.away.id,
                name: item.teams.away.name,
                logo: item.teams.away.logo
            },
            date: item.fixture.date,
            status: {
                short: item.fixture.status.short, // API-Sports uses standard short codes (NS, FT, PST)
                elapsed: item.fixture.status.elapsed
            },
            goals: {
                home: item.goals.home,
                away: item.goals.away
            },
            prediction: null
        }));

        console.log(`[Mapped] ${mappedFixtures.length} matches for ${targetDateKey} via API-Sports`);
        return mappedFixtures as Fixture[];

    } catch (error) {
        console.error("API-Sports Fetch Error:", error);
        return [];
    }
};

/**
 * Generic helper to fetch data from API-Sports with caching.
 * @param endpoint API endpoint (e.g. "/fixtures/statistics")
 * @param params Query parameters
 * @param cacheKeyPrefix Redis key prefix
 * @param ttlSeconds Cache TTL
 * @param forceRefresh Ignore cache
 */
async function fetchFromApiRich<T>(
    endpoint: string,
    params: any,
    cacheKeyPrefix: string,
    ttlSeconds: number,
    forceRefresh: boolean
): Promise<T | null> {
    if (!API_KEY) return null;

    // Build Cache Key
    const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, val]) => `${key}=${val}`)
        .join(':');
    const cacheKey = `${cacheKeyPrefix}:${paramString}`;

    // 1. Try Cache
    if (!forceRefresh && redis) {
        try {
            const cached = await redis.get<T>(cacheKey);
            if (cached) {
                // console.log(`[API-Sports Cache Hit] ${cacheKey}`);
                return cached;
            }
        } catch (e) {
            console.error(`Redis Read Error (${cacheKey}):`, e);
        }
    }

    // 2. Fetch API
    const quotas = checkQuotas();
    if (quotas.api_sports_rate_limited) {
        // console.warn(`[Quota] Skipping ${endpoint} due to API-Sports rate limit cooldown.`);
        return null;
    }

    try {
        const validHeaders: any = { 'x-apisports-key': API_KEY };
        if (API_HOST?.includes('rapidapi')) {
            validHeaders['x-rapidapi-host'] = API_HOST;
            validHeaders['x-rapidapi-key'] = API_KEY;
        }

        const response = await axios.get(`${BASE_URL}${endpoint}`, {
            params,
            headers: validHeaders
        });

        // --- CAPTURE QUOTA HEADERS ---
        const remaining = response.headers['x-ratelimit-requests-remaining'];
        const limit = response.headers['x-ratelimit-requests-limit'];
        const used = response.headers['x-ratelimit-requests-used'];

        if (remaining !== undefined) QUOTA_STATUS.api_sports_remaining = parseInt(remaining as string);
        if (limit !== undefined) QUOTA_STATUS.api_sports_limit = parseInt(limit as string);
        if (used !== undefined) QUOTA_STATUS.api_sports_used = parseInt(used as string);

        const data = response.data.response;

        // 3. Save Cache
        if (data && redis) { // Store 'response' or 'response.response'? usually the array is passed as T
            // API-Sports returns { get:..., parameters:..., errors:..., results:..., paging:..., response: ... }
            // We generally just want 'response' part.
            await redis.set(cacheKey, data, { ex: ttlSeconds });
        }

        return data as T;
    } catch (error: any) {
        if (error.response?.status === 429) {
            console.error(`[CRITICAL] API-Sports Rate Limit (429) at ${endpoint}. Entering 1-hour cooldown.`);
            QUOTA_STATUS.api_sports_rate_limited = true;
            QUOTA_STATUS.last_429_at = Date.now();
        } else {
            console.error(`API-Sports Rich Fetch Error (${endpoint}):`, error.message);
        }
        return null;
    }
}

// --- NEW PRO FETCH METHODS ---

// Helper interfaces for wrappers
interface OddsResponse {
    league: any;
    fixture: any;
    update: string;
    bookmakers: MarketOdds[];
}

interface PlayerStatsResponse {
    team: { id: number; name: string; logo: string };
    players: PlayerStats[];
}

export const fetchMatchStats = async (fixtureId: number, forceRefresh = false): Promise<TeamMatchStats[] | null> => {
    return fetchFromApiRich<TeamMatchStats[]>(
        "/fixtures/statistics",
        { fixture: fixtureId },
        "fixtures:stats",
        3600, // 1 hour (stats might update post-game corrections, but 1h is fine usually)
        forceRefresh
    );
};

export const fetchMatchLineups = async (fixtureId: number, forceRefresh = false): Promise<TeamLineup[] | null> => {
    return fetchFromApiRich<TeamLineup[]>(
        "/fixtures/lineups",
        { fixture: fixtureId },
        "fixtures:lineups",
        900, // 15 mins (critical for pre-match)
        forceRefresh
    );
};

export const fetchInjuries = async (fixtureId: number, forceRefresh = false): Promise<Injury[] | null> => {
    return fetchFromApiRich<Injury[]>(
        "/injuries",
        { fixture: fixtureId },
        "fixtures:injuries",
        1800, // 30 mins
        forceRefresh
    );
};

export const fetchPlayerStats = async (fixtureId: number, forceRefresh = false): Promise<PlayerStatsResponse[] | null> => {
    return fetchFromApiRich<PlayerStatsResponse[]>(
        "/fixtures/players",
        { fixture: fixtureId },
        "fixtures:players",
        3600, // 1 hour
        forceRefresh
    );
};

export const fetchOdds = async (fixtureId: number, forceRefresh = false): Promise<MarketOdds[] | null> => {
    // Bet365 (ID 1) is usually the standard reference
    const data = await fetchFromApiRich<OddsResponse[]>(
        "/odds",
        { fixture: fixtureId, bookmaker: 1 },
        "fixtures:odds",
        300, // 5 mins (odds change fast)
        forceRefresh
    );

    if (data && data.length > 0) {
        return data[0].bookmakers;
    }
    return null;
};

// Helper to determine if a match is finished based on API-Sports statuses
const finishedStates = ['FT', 'AET', 'PEN'];

// Helper to fetch real-time news via Google News RSS
const fetchTeamNews = async (home: string, away: string): Promise<string> => {
    try {
        const query = `${home} vs ${away} team news injuries`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`; // targeting UK english for football coverage
        const { data } = await axios.get(url, { timeout: 5000 }); // Add timeout to prevent hanging

        // Simple regex to extract titles (lighter than xml parser)
        const items = data.match(/<item>[\s\S]*?<\/item>/g) || [];
        const headlines = items.slice(0, 3).map((item: string) => {
            const titleMatch = item.match(/<title>(.*?)<\/title>/);
            return titleMatch ? titleMatch[1] : "";
        }).filter(Boolean);

        return headlines.join(". ");
    } catch (e: any) {
        // Only log if it's a major/unusual error, don't spam for routine fetch failures on obscure teams
        if (e.response?.status === 429) {
            console.warn(`[News API] Rate limited by Google News`);
        } else if (e.code === 'ECONNABORTED') {
            // Silently skip timeouts
        }
        return "";
    }
};


// AI Analysis with DeepSeek (Enhanced with Football Highlights API)
export const analyzeFixtures = async (fixtures: Fixture[], forceRefresh: boolean = false): Promise<Fixture[]> => {
    if (!DEEPSEEK_KEY || fixtures.length === 0) return fixtures;

    const quotas = checkQuotas();
    if (quotas.deepseek_billing_empty) {
        console.warn("[Quota] Skipping AI analysis: DeepSeek Billing empty.");
        return fixtures; // Return without predictions
    }

    // Implementation of Chunking: DeepSeek might fail with too many matches in one prompt
    const CHUNK_SIZE = 20;
    const fixtureChunks = [];
    for (let i = 0; i < fixtures.length; i += CHUNK_SIZE) {
        fixtureChunks.push(fixtures.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[AI Analysis] Total matches: ${fixtures.length}. Processing in ${fixtureChunks.length} chunks...`);

    const allAnalyzedFixtures: Fixture[] = [];

    // --- CONCURRENCY THROTTLING ---
    // We process chunks in batches of 5 to avoid hitting API rate limits
    // even if we have 1000+ matches (50+ chunks)
    const BATCH_SIZE = 5;
    for (let i = 0; i < fixtureChunks.length; i += BATCH_SIZE) {
        const batch = fixtureChunks.slice(i, i + BATCH_SIZE);
        console.log(`[AI Analysis] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} chunks)...`);

        const chunkPromises = batch.map(async (chunk, chunkIdx) => {
            const globalIdx = i + chunkIdx;
            console.log(`[AI Analysis] Processing chunk ${globalIdx + 1}/${fixtureChunks.length} (${chunk.length} matches)...`);

            try {
                // STEP 1: Enrich fixtures with Football Highlights API data
                const { enrichFixtures, buildEnrichedContext } = await import('./match-enrichment-service');
                const enrichedChunk = await enrichFixtures(chunk, 5, forceRefresh);

                // STEP 2: Fetch News for matches in this chunk in parallel
                const fixturesWithNewsAndData = await Promise.all(enrichedChunk.map(async (f) => {
                    const news = await fetchTeamNews(f.homeTeam.name, f.awayTeam.name);
                    return { ...f, newsContext: news };
                }));

                // STEP 3: Build enriched data for AI prompt
                const fixturesData = fixturesWithNewsAndData.map(f => ({
                    id: f.id,
                    match: `${f.homeTeam.name} vs ${f.awayTeam.name}`,
                    league: f.league.name,
                    news_headlines: f.newsContext || "No recent news found.",
                    enriched_data: buildEnrichedContext(f.enrichedData)
                }));

                const prompt = `
                You are the world's most advanced football betting algorithm, calibrated for "sharp" money. 
                Your goal is NOT just to pick winners, but to identify POSITIVE EXPECTED VALUE (+EV) based on genuine probability vs market perception.

                INPUT DATA:
                ${JSON.stringify(fixturesData, null, 2)}

                MODELS TO APPLY:
                1. **Poisson Distribution**: Estimate Expected Goals (xG) for both teams based on recent attack/defense ratings.
                2. **Elo/Power Ratings**: Compare raw squad strength.
                3. **Contextual Impact**: Adjust for "Must Win" situations, severe injuries (using the provided news), and Hostile Atmosphere.
                4. **Variance Analysis**: If a result relies on luck (e.g., a lucky 1-0 win streak), REGRESS it to the mean.
                5. **Market Efficiency**: Compare your probability against the provided bookmaker odds to identify value.

                CRITICAL INSTRUCTIONS:
                1. **USE THE ENRICHED DATA**: You now have access to REAL statistics including:
                   - **CONFIRMED LINEUPS** & Formations (Adjust for tactical mismatches).
                   - **CRITICAL INJURIES**: If key players are missing (as listed in Injury Report), penalize the team heavily.
                   - **SHARP MARKET MOVES**: Pay attention to "Odds CRASHING" alerts - this indicates massive sharp money.
                   - Team performance metrics & xG.
                
                2. **Parse NEWS HEADLINES & INJURIES**: 
                   - If a Top Scorer/Captain/Playmaker is listed in the **INJURY REPORT**, penalize the team by 20% immediately.
                   - If the Market is moving AGAINST a team (Odds drifting up), trust the market over the stats.
                
                3. **Calculate "True Probability"**: Use the enriched data (xG, lineups, injuries) to calculate accurate probabilities.
                
                4. **Identify Value Bets**: Compare your calculated probability against the provided market odds.
                
                5. **Select the outcome** with the highest confidence relative to risk.

                6. **DATA AVAILABILITY CHECK**: 
                   - If \`enriched_data\` contains "No enriched data available", **YOU MUST NOT** assign confidence > 70%.
                   - Mark \`isRisky: true\` automatically if data is missing.
                   - Explicitly state "Limited data availability" in the analysis.

                OUTPUT REQUIREMENTS:
                - **picked**: The specific market (e.g., "Arsenal Win", "Over 2.5 Goals", "BTTS Yes").
                - **confidence**: A precise integer (0-100).
                    - 90-100%: "BANKER" (Requires: Tier 1 League, Lineups Confirmed, Smart Money Agreement).
                    - 80-89%: "High Confidence" (Strong statistical edge, no red flags).
                    - 70-79%: "Medium" (Likely, but some risk).
                    - <70%: "Risky" (Pass or small stake).
                - **reasoning**: Array of 3 short, punchy, data-driven points (max 15 words each) for the card summary.
                - **analysis**: A STRUCTURED, 200-WORD ANALYSIS separated by '###' headers.
                    - Format MUST be exactly as follows:
                    ### Overview
                    (2-3 sentences setting the scene, form, and tactical context)
                    
                    ### Key Points
                    (Bullet points of key stats/tactics, e.g.)
                    • Point 1
                    • Point 2
                    • Point 3
                    
                    ### Expectation
                    (Final verdict and prediction reasoning)

                - **type**: "result" | "goals" | "score".
                - **isRisky**: true if confidence < 75%.
                - **requiresTier**: "vip" for confidence >= 90%, "standard" for 80-89%, "basic" for 70-79%, "free" otherwise.

                Return strictly a JSON array:
                [{"id": number, "picked": string, "confidence": number, "reasoning": string[], "analysis": string, "type": "result"|"goals"|"score", "isRisky": boolean, "requiresTier": string, "probabilities": {"home": number, "draw": number, "away": number}, "h2h": string}]
            `;

                const response = await axios.post(DEEPSEEK_URL, {
                    model: "deepseek-chat",
                    messages: [
                        { role: "system", content: "You are a professional betting analyst with access to real-time statistics. You verify facts and use data-driven analysis before predicting." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                }, {
                    headers: {
                        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });

                let content = response.data.choices[0].message.content.trim();
                if (content.startsWith("```")) {
                    content = content.replace(/^```json\s?/, "").replace(/^```\s?/, "").replace(/```$/, "");
                }

                const predictions = JSON.parse(content);
                const predictionArray = Array.isArray(predictions) ? predictions : (predictions.predictions || []);

                return chunk.map(fixture => {
                    const pred = predictionArray.find((p: any) => p.id === fixture.id);
                    if (!pred) return fixture;

                    const TIER_1_KEYWORDS = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "Champions League", "Europa League", "Eredivisie", "Primeira Liga", "World Cup", "Euro", "Copa America", "Libertadores", "Brasileiro", "Championship"];
                    const isTier1 = TIER_1_KEYWORDS.some(k => fixture.league.name.includes(k));

                    let finalConfidence = pred.confidence;
                    let finalTier = pred.requiresTier;
                    let finalReasoning = Array.isArray(pred.reasoning) ? [...pred.reasoning] : [typeof pred.reasoning === 'string' ? pred.reasoning : "AI analysis based on recent form and stats."];
                    let finalIsRisky = pred.isRisky;

                    if ((pred.picked || "").toLowerCase().includes((fixture.awayTeam.name || "").toLowerCase()) || (pred.picked || "").toLowerCase().includes("away")) {
                        finalConfidence = Math.max(0, finalConfidence - 10);
                        finalReasoning.push("Confidence penalty: Away match.");
                    }

                    if (["Champions League", "Europa League", "Conference League"].some(l => fixture.league.name.includes(l))) {
                        finalIsRisky = true;
                        finalReasoning.push("High volatility: European fixture.");
                    }

                    if (finalTier === 'vip' && !isTier1) {
                        finalConfidence = Math.min(finalConfidence, 85);
                        finalReasoning.push("Capped confidence: Non-Tier 1 League.");
                    }

                    if (finalConfidence < 75) finalIsRisky = true;
                    if (finalConfidence >= 90) finalTier = 'vip';
                    else if (finalConfidence >= 80) finalTier = 'standard';
                    else if (finalConfidence >= 70) finalTier = 'basic';
                    else finalTier = 'free';

                    return {
                        ...fixture,
                        prediction: {
                            picked: pred.picked,
                            confidence: finalConfidence,
                            reasoning: finalReasoning,
                            analysis: pred.analysis || "Full analysis pending.",
                            type: pred.type,
                            isRisky: finalIsRisky,
                            requiresTier: finalTier,
                            probabilities: pred.probabilities,
                            h2h: pred.h2h
                        }
                    };
                });
            } catch (error: any) {
                if (error.response?.status === 402) {
                    console.error("[CRITICAL] DeepSeek Billing Empty (402). Entering 1-hour cooldown.");
                    QUOTA_STATUS.deepseek_billing_empty = true;
                    QUOTA_STATUS.last_402_at = Date.now();
                } else {
                    console.error(`DeepSeek Analysis Error (Chunk ${i + 1}):`, error.message);
                }
                return chunk;
            }
        });

        const results = await Promise.all(chunkPromises);
        results.forEach(chunk => {
            if (chunk) allAnalyzedFixtures.push(...chunk);
        });
    }

    return allAnalyzedFixtures;
};


export const getFixtures = async (
    date: Date,
    sport: Sport = "football",
    showPast: boolean = false,
    forceRefresh: boolean = false,
    statusOnly: boolean = false
): Promise<Fixture[]> => {
    const dateKey = format(date, "yyyy-MM-dd");
    const nairobiNow = getNairobiNow();

    // 1. Try Redis (L1 Cache)
    const redisKey = `fixtures:${sport}:${dateKey}`;
    if (!forceRefresh && redis) {
        try {
            const cached = await redis?.get<Fixture[]>(redisKey);
            if (cached && cached.length > 0) {
                console.log(`[Redis Hit] Serving ${cached.length} ${sport} fixtures for ${dateKey}`);
                return cached;
            }
        } catch (err) {
            console.error("Redis Read Error", err);
        }
    }

    // 2. Try Firestore Cache (Skip if forceRefresh)
    let fixtures: Fixture[] = [];
    if (!forceRefresh) {
        try {
            const q = query(
                collection(db, "fixtures"),
                where("dateKey", "==", dateKey),
                where("sport", "==", sport)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                fixtures = querySnapshot.docs.map(doc => doc.data() as Fixture);
                console.log(`[Cache Hit] Serving ${fixtures.length} ${sport} fixtures for ${dateKey}`);

                // Back-fill Redis for next time
                if (redis) {
                    const isPast = new Date(dateKey) < new Date(getNairobiNow().toISOString().split('T')[0]);
                    const ttl = isPast ? 86400 : 600; // 24h for past, 10m for future/today
                    await redis?.set(redisKey, fixtures, { ex: ttl });
                }
            }
        } catch (err) {
            console.error("Cache Read Error", err);
        }
    }

    // 2. Cache Miss or Stale Detection -> Real API
    const isStale = (fixtures: Fixture[]) => {
        // If no fixtures, obviously not stale (it's a miss)
        if (fixtures.length === 0) return true;

        const now = getNairobiNow();

        // Check for matches that should have finished but are still TBD or NS
        const statusStale = fixtures.some(f => {
            const matchDate = new Date(f.date);
            // If match started more than 2.5 hours ago but isn't finished
            const startedLongAgo = matchDate.getTime() < (now.getTime() - (150 * 60000));
            const isUnfinished = !finishedStates.includes(f.status.short);
            return startedLongAgo && isUnfinished;
        });

        // NEW: Check if we are missing the 'analysis' field for upcoming detailed views
        // This ensures old cached predictions get upgraded to the new format
        const analysisStale = fixtures.some(f => {
            const matchDate = new Date(f.date);
            const isFuture = matchDate > now;
            const hasPrediction = !!f.prediction;
            const missingAnalysis = !f.prediction?.analysis;

            // Only force refresh if it's a future game with a prediction but NO analysis
            return isFuture && hasPrediction && missingAnalysis;
        });

        return statusStale || analysisStale;
    };

    if (fixtures.length === 0 || forceRefresh || isStale(fixtures)) {
        console.log(`[Fetch Triggered] Reason: ${fixtures.length === 0 ? 'Cache Miss' : forceRefresh ? 'Force Refresh' : 'Stale Detected'} for ${sport} on ${dateKey}`);

        // --- NEW NON-BLOCKING STRATEGY ---
        // If we HAVE fixtures but they are stale, and we are NOT in a cron job (forceRefresh is false),
        // we return the stale fixtures now and trigger the update in the background.
        if (fixtures.length > 0 && !forceRefresh) {
            console.log(`[SWR] Serving stale data for ${dateKey} while refreshing in background...`);
            // We return now, but we don't 'await' the fetch/analyze block.
            // Note: In Next.js Server Components / API Routes, unawaited promises can be tricky
            // if the serverless function exits immediately. 
            // However, for this project, serving stale is better than a 30s delay.
            // A dedicated cron will handle the actual deep refresh.
            return fixtures;
        }

        const rawFixtures = await fetchFromApi(date, sport);

        if (rawFixtures && rawFixtures.length > 0) {
            if (statusOnly && fixtures.length > 0) {
                console.log(`[Status Only] Updating scores for ${rawFixtures.length} matches...`);
                // Merge new statuses into existing analyzed fixtures
                fixtures = rawFixtures.map(raw => {
                    const existing = fixtures.find(f => f.id === raw.id);
                    return {
                        ...raw,
                        prediction: existing?.prediction || null // Keep existing analysis
                    };
                });
            } else {
                // Run AI Analysis immediately on new data
                console.log(`[AI Analysis] Processing ${rawFixtures.length} ${sport} matches with DeepSeek...`);
                fixtures = await analyzeFixtures(rawFixtures, forceRefresh);
            }

            try {
                const batch = writeBatch(db);
                fixtures.forEach(fixture => {
                    const docRef = doc(db, "fixtures", `${sport}-${dateKey}-${fixture.id}`);
                    batch.set(docRef, { ...fixture, dateKey, socialPosted: fixture.socialPosted ?? false });
                });
                await batch.commit();
                console.log(`[Cache Update] Saved ${fixtures.length} analyzed ${sport} matches for ${dateKey}.`);

                // Update Redis too
                if (redis) {
                    const isPastDate = new Date(dateKey) < new Date(getNairobiNow().toISOString().split('T')[0]);
                    const ttl = isPastDate ? 86400 : 600; // 24h for past, 10m for future
                    await redis?.set(redisKey, fixtures, { ex: ttl });
                }
            } catch (err) {
                console.error("Cache Write Error", err);
            }
        }
    }

    // 3. Past Game Filtering
    let results = fixtures;
    if (!showPast) {
        results = fixtures.filter(f => {
            const matchDate = new Date(f.date);
            return matchDate.getTime() > (new Date().getTime() - (15 * 60000));
        });
    }

    // Default Sort: Chronological (Earliest first)
    return results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Client-safe version of getFixtures that calls our internal API route.
 * Use this in components (useEffect) to avoid exposing keys or direct Firestore writes.
 */
export const getFixturesClient = async (date: Date, sport: Sport = "football", showPast: boolean = false, refresh: boolean = false): Promise<{ fixtures: Fixture[], quota?: any }> => {
    try {
        const dateStr = format(date, "yyyy-MM-dd");
        const response = await axios.get(`/api/fixtures?date=${dateStr}&sport=${sport}&showPast=${showPast}&refresh=${refresh}`);
        return {
            fixtures: response.data.fixtures || [],
            quota: response.data.quota
        };
    } catch (err) {
        console.error("Client Fetch Error:", err);
        return { fixtures: [], quota: null };
    }
};

/**
 * Proactively syncs and analyzes fixtures for a range of days.
 * @param days Total number of days to sync
 * @param analyzeObscure If true, even non-core leagues will be analyzed by AI
 */
export const syncAllFixtures = async (days: number = 7, startOffset: number = 0, analyzeObscure: boolean = false): Promise<void> => {
    const nairobiNow = getNairobiNow();
    console.log(`[Sync Started] Proactively analyzing ${days} days starting from offset ${startOffset}...`);

    for (let i = startOffset; i < (startOffset + days); i++) {
        const targetDate = addDays(nairobiNow, i);
        const dateKey = format(targetDate, "yyyy-MM-dd");
        console.log(`--- Syncing Football for ${dateKey} ---`);

        // 1. Fetch raw fixtures
        const raw = await fetchFromApi(targetDate);
        if (!raw || raw.length === 0) continue;

        // 2. TIERED ANALYSIS: Determine which matches to analyze
        // Priority logic:
        // - Today (offset 0): ALWAYS Deep Sync (analyze all matches) so users never see "crunching".
        // - Future: Only Core Leagues by default, manual triggers for obscure.
        // - Past: Skip entirely (already handled).

        const isTodaySync = i === 0;
        const shouldDeepSync = analyzeObscure || isTodaySync;

        const matchesToAnalyze = shouldDeepSync ? raw : raw.filter(f => isCoreLeague(f.league.name));
        const matchesToSkip = shouldDeepSync ? [] : raw.filter(f => !isCoreLeague(f.league.name));

        console.log(`[Sync] ${dateKey} (Offset: ${i}) | Mode: ${shouldDeepSync ? 'DEEP' : 'PRIORITY'}. Analyzing ${matchesToAnalyze.length} matches...`);

        // 3. Analyze matches (chunked & throttled)
        const analyzed = await analyzeFixtures(matchesToAnalyze);
        const allFixtures = [...analyzed, ...matchesToSkip];

        // 4. Batch Save to Firestore
        try {
            const batch = writeBatch(db);
            allFixtures.forEach(fixture => {
                const docRef = doc(db, "fixtures", `football-${dateKey}-${fixture.id}`);
                batch.set(docRef, { ...fixture, dateKey, sport: "football", socialPosted: fixture.socialPosted ?? false });
            });
            await batch.commit();

            // 5. Update Redis
            if (redis) {
                const redisKey = `fixtures:football:${dateKey}`;
                await redis.set(redisKey, allFixtures, { ex: 600 });
            }
        } catch (err) {
            console.error(`[Sync] Error saving ${dateKey}:`, err);
        }
    }
    console.log("[Sync Completed]");
};

export async function saveOpeningOdds(fixtureId: number, odds: { home: number, draw: number, away: number }) {
    if (!db) return;
    try {
        const q = query(collection(db, "fixtures"), where("id", "==", fixtureId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const data = snapshot.docs[0].data();
            // Only save if not already present
            if (!data.openingOdds) {
                await updateDoc(docRef, {
                    openingOdds: {
                        ...odds,
                        timestamp: Date.now()
                    }
                });
                console.log(`[Smart Money] Saved opening odds for fixture ${fixtureId}`);
            }
        }
    } catch (error) {
        console.error("Error saving opening odds:", error);
    }
}
