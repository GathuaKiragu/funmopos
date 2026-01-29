import { format, subDays, addDays, isPast, addHours } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
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
        name: string;
        logo: string;
    };
    awayTeam: {
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
    prediction?: {
        picked: string;
        confidence: number;
        reasoning: string | string[]; // Backwards compatible
        type: "result" | "goals" | "score";
        isRisky: boolean;
        requiresTier: "free" | "basic" | "standard" | "vip";
    } | null;
}

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = `https://${API_HOST}`;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Competition mapping: Premier League (PL), Championship (ELC), La Liga (PD), Serie A (SA), Bundesliga (BL1), Ligue 1 (FL1), Eredivisie (DED), Primeira Liga (PPL)
// Expanded: CL (Champions League), EL (Europa League), EC (Euro), WC (World Cup), CLI (Libertadores), BSA (Brazil Serie A)
const COMPETITIONS = ["PL", "ELC", "PD", "SA", "BL1", "FL1", "DED", "PPL", "CL", "EL", "EC", "WC", "CLI", "BSA"];

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
const fetchFromApi = async (targetDate: Date, sport: Sport = "football"): Promise<Fixture[]> => {
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
        const response = await axios.get(`${BASE_URL}/fixtures`, {
            params: {
                date: targetDateKey,
            },
            headers: {
                'x-apisports-key': API_KEY,
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY
            }
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
                name: item.teams.home.name,
                logo: item.teams.home.logo
            },
            awayTeam: {
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

// Helper to determine if a match is finished based on API-Sports statuses
const finishedStates = ['FT', 'AET', 'PEN'];

// Helper to fetch real-time news via Google News RSS
const fetchTeamNews = async (home: string, away: string): Promise<string> => {
    try {
        const query = `${home} vs ${away} team news injuries`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`; // targeting UK english for football coverage
        const { data } = await axios.get(url);

        // Simple regex to extract titles (lighter than xml parser)
        const items = data.match(/<item>[\s\S]*?<\/item>/g) || [];
        const headlines = items.slice(0, 3).map((item: string) => {
            const titleMatch = item.match(/<title>(.*?)<\/title>/);
            return titleMatch ? titleMatch[1] : "";
        }).filter(Boolean);

        return headlines.join(". ");
    } catch (e) {
        console.warn(`News fetch failed for ${home} vs ${away}`);
        return "";
    }
};

// AI Analysis with DeepSeek
const analyzeFixtures = async (fixtures: Fixture[]): Promise<Fixture[]> => {
    if (!DEEPSEEK_KEY || fixtures.length === 0) return fixtures;

    // Implementation of Chunking: DeepSeek might fail with too many matches in one prompt
    const CHUNK_SIZE = 20;
    const fixtureChunks = [];
    for (let i = 0; i < fixtures.length; i += CHUNK_SIZE) {
        fixtureChunks.push(fixtures.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[AI Analysis] Total matches: ${fixtures.length}. Processing in ${fixtureChunks.length} chunks...`);

    const allAnalyzedFixtures: Fixture[] = [];

    for (let i = 0; i < fixtureChunks.length; i++) {
        const chunk = fixtureChunks[i];
        console.log(`[AI Analysis] Processing chunk ${i + 1}/${fixtureChunks.length} (${chunk.length} matches)...`);

        // 1. Fetch News for matches in this chunk in parallel
        const fixturesWithNews = await Promise.all(chunk.map(async (f) => {
            const news = await fetchTeamNews(f.homeTeam.name, f.awayTeam.name);
            return {
                ...f,
                newsContext: news
            };
        }));

        const fixturesData = fixturesWithNews.map(f => ({
            id: f.id,
            match: `${f.homeTeam.name} vs ${f.awayTeam.name}`,
            league: f.league.name,
            news_headlines: f.newsContext || "No recent news found."
        }));

        const prompt = `
            You are the world's most advanced football betting algorithm, calibrated for "sharp" money. 
            Your goal is NOT just to pick winners, but to identify POSITIVE EXPECTED VALUE (+EV) based on genuine probability vs market perception.

            INPUT DATA:
            ${JSON.stringify(fixturesData)}

            MODELS TO APPLY:
            1. **Poisson Distribution**: Estimate Expected Goals (xG) for both teams based on recent attack/defense ratings.
            2. **Elo/Power Ratings**: Compare raw squad strength.
            3. **Contextual Impact**: Adjust for "Must Win" situations, severe injuries (using the provided news), and Hostile Atmosphere.
            4. **Variance Analysis**: If a result relies on luck (e.g., a lucky 1-0 win streak), REGRESS it to the mean.

            EXECUTION STEPS:
            1. Parse the provided NEWS HEADLINES. If a key player (Top Scorer/Captain/Playmaker) is missing, penalize the team by 15-20% immediately.
            2. Calculate the "True Probability" of each outcome (Home/Draw/Away).
            3. Compare your probability against standard market odds trends.
            4. Select the outcome with the highest confidence relative to risk.

            OUTPUT REQUIREMENTS:
            - **picked**: The specific market (e.g., "Arsenal Win", "Over 2.5 Goals", "BTTS Yes").
            - **confidence**: A precise integer (0-100).
                - 95-100%: "Verified Lock" (Exceptional statistical certainty, <5% variance).
                - 85-94%: "Strong Edge" (High probability value).
                - 75-84%: "Value Play" (Solid edge).
                - <75%: "Risky/Lean" (Mark isRisky: true).
            - **reasoning**: Array of 3 short, punchy, data-driven points.
                - Point 1: Statistical edge (e.g., "xG suggests underperformance...").
                - Point 2: Tactical/News factor (e.g., "Kane injury leaves hole in attack").
                - Point 3: Comparison (e.g., "Home form > Away weakness").
            - **type**: "result" | "goals" | "score".
            - **isRisky**: true if confidence < 75%.
            - **requiresTier**: "vip" for confidence >= 90%, "standard" for 80-89%, "basic" for 70-79%, "free" otherwise.

            Return strictly a JSON array:
            [{"id": number, "picked": string, "confidence": number, "reasoning": string[], "type": "result"|"goals"|"score", "isRisky": boolean, "requiresTier": string}]
        `;

        try {
            const response = await axios.post(DEEPSEEK_URL, {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are a professional betting analyst. You verify facts before predicting." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const content = response.data.choices[0].message.content;
            const predictions = JSON.parse(content);

            // Handle if AI returns { "predictions": [...] } instead of just array
            const predictionArray = Array.isArray(predictions) ? predictions : (predictions.predictions || []);

            const analyzedChunk = chunk.map(fixture => {
                const pred = predictionArray.find((p: any) => p.id === fixture.id);
                if (pred) {
                    return {
                        ...fixture,
                        prediction: {
                            picked: pred.picked,
                            confidence: pred.confidence,
                            reasoning: pred.reasoning || ["AI analysis based on recent form and stats."],
                            type: pred.type,
                            isRisky: pred.isRisky,
                            requiresTier: pred.requiresTier
                        }
                    };
                }
                return fixture;
            });

            allAnalyzedFixtures.push(...analyzedChunk);

        } catch (error) {
            console.error(`DeepSeek Analysis Error (Chunk ${i + 1}):`, error);
            allAnalyzedFixtures.push(...chunk); // Fallback to unanalyzed for this chunk
        }
    }

    return allAnalyzedFixtures;
};

export const getFixtures = async (
    date: Date,
    sport: Sport = "football",
    showPast: boolean = false,
    forceRefresh: boolean = false
): Promise<Fixture[]> => {
    const dateKey = format(date, "yyyy-MM-dd");
    const nairobiNow = getNairobiNow();

    // 1. Try Redis (L1 Cache)
    const redisKey = `fixtures:${sport}:${dateKey}`;
    if (!forceRefresh && isRedisEnabled()) {
        try {
            const cached = await redis.get<Fixture[]>(redisKey);
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
                if (isRedisEnabled()) {
                    const isPast = new Date(dateKey) < new Date(getNairobiNow().toISOString().split('T')[0]);
                    const ttl = isPast ? 86400 : 600; // 24h for past, 10m for future/today
                    await redis.set(redisKey, fixtures, { ex: ttl });
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

        // Check for matches that should have finished but are still TBD or NS
        const now = getNairobiNow();
        return fixtures.some(f => {
            const matchDate = new Date(f.date);
            // If match started more than 2.5 hours ago but isn't finished
            const startedLongAgo = matchDate.getTime() < (now.getTime() - (150 * 60000));
            const isUnfinished = !finishedStates.includes(f.status.short);
            return startedLongAgo && isUnfinished;
        });
    };

    if (fixtures.length === 0 || forceRefresh || isStale(fixtures)) {
        console.log(`[Fetch Triggered] Reason: ${fixtures.length === 0 ? 'Cache Miss' : forceRefresh ? 'Force Refresh' : 'Stale Detected'} for ${sport} on ${dateKey}`);
        const rawFixtures = await fetchFromApi(date, sport);

        if (rawFixtures && rawFixtures.length > 0) {
            // Run AI Analysis immediately on new data
            console.log(`[AI Analysis] Processing ${rawFixtures.length} ${sport} matches with DeepSeek...`);
            fixtures = await analyzeFixtures(rawFixtures);

            try {
                const batch = writeBatch(db);
                fixtures.forEach(fixture => {
                    const docRef = doc(db, "fixtures", `${sport}-${dateKey}-${fixture.id}`);
                    batch.set(docRef, { ...fixture, dateKey });
                });
                await batch.commit();
                console.log(`[Cache Update] Saved ${fixtures.length} analyzed ${sport} matches for ${dateKey}.`);

                // Update Redis too
                if (isRedisEnabled()) {
                    const isPastDate = new Date(dateKey) < new Date(getNairobiNow().toISOString().split('T')[0]);
                    const ttl = isPastDate ? 86400 : 600; // 24h for past, 10m for future
                    await redis.set(redisKey, fixtures, { ex: ttl });
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
export const getFixturesClient = async (date: Date, sport: Sport = "football", showPast: boolean = false, refresh: boolean = false): Promise<Fixture[]> => {
    try {
        const dateStr = format(date, "yyyy-MM-dd");
        const response = await axios.get(`/api/fixtures?date=${dateStr}&sport=${sport}&showPast=${showPast}&refresh=${refresh}`);
        return response.data.fixtures || [];
    } catch (err) {
        console.error("Client Fetch Error:", err);
        return [];
    }
};

/**
 * Proactively syncs and analyzes fixtures for a range of days.
 * @param days Total number of days to sync
 * @param startOffset The starting day relative to today (e.g., -1 for yesterday)
 */
export const syncAllFixtures = async (days: number = 7, startOffset: number = 0): Promise<void> => {
    const nairobiNow = getNairobiNow();
    console.log(`[Sync Started] Current Nairobi Time: ${format(nairobiNow, "yyyy-MM-dd HH:mm")}`);
    console.log(`Proactively analyzing ${days} days starting from offset ${startOffset}...`);

    const sports: Sport[] = ["football"];

    for (const sport of sports) {
        for (let i = startOffset; i < (startOffset + days); i++) {
            const targetDate = addDays(nairobiNow, i);
            const dateKey = format(targetDate, "yyyy-MM-dd");
            console.log(`--- Syncing ${sport} for ${dateKey} ---`);
            // We use forceRefresh=true to ensure we pick up final scores for past games 
            // and new matches recently added to API for future games.
            await getFixtures(targetDate, sport, true, true);
        }
    }
    console.log("[Sync Completed]");
};
