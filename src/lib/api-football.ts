import { format, subDays, addDays, isPast, addHours } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import axios from "axios";
import { scrapeFixtures } from './scraper';

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

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";
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
        console.error("Missing FOOTBALL_DATA_API_KEY");
        return [];
    }

    const targetDateKey = format(targetDate, "yyyy-MM-dd");

    // API expects dateFrom (inclusive) and dateTo (exclusive), so we add 1 day to dateTo
    const dateFrom = format(subDays(targetDate, 1), "yyyy-MM-dd");
    const dateTo = format(addDays(targetDate, 1), "yyyy-MM-dd");

    try {
        const response = await axios.get(`${BASE_URL}/matches`, {
            params: {
                dateFrom,
                dateTo
            },
            headers: {
                'X-Auth-Token': API_KEY
            }
        });

        const rawMatches = response.data.matches;
        if (!rawMatches || !Array.isArray(rawMatches)) return [];

        console.log(`[API Response] Received ${rawMatches.length} total matches from API`);

        // Filter and map matches
        // WE RELAX FILTERS TO INCLUDE EVERYTHING as per user request to "ensure we have all data"
        // ABSOLUTELY NO COUNTRY FILTERING - Show ALL 1000+ leagues if available
        const filteredFixtures = rawMatches
            .filter((match: any) => {
                // Filter by Nairobi date only
                // Use robust timezone conversion independent of server local time
                const utcDate = new Date(match.utcDate);
                const nairobiDateString = utcDate.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
                return nairobiDateString === targetDateKey;
            })
            .map((match: any) => ({
                id: match.id,
                sport: "football" as Sport,
                league: {
                    name: match.competition.name,
                    logo: match.competition.emblem,
                    flag: match.area.flag || ""
                },
                homeTeam: {
                    name: match.homeTeam.name,
                    logo: match.homeTeam.crest
                },
                awayTeam: {
                    name: match.awayTeam.name,
                    logo: match.awayTeam.crest
                },
                date: match.utcDate,
                status: {
                    short: mapStatus(match.status),
                    elapsed: null
                },
                goals: {
                    home: match.score?.fullTime?.home ?? null,
                    away: match.score?.fullTime?.away ?? null
                },
                prediction: null
            }));

        console.log(`[Filtered] ${filteredFixtures.length} matches for ${targetDateKey} (Full Coverage)`);
        return filteredFixtures as Fixture[];

    } catch (error) {
        console.error("Football-Data Fetch Error:", error);
        return [];
    }
};

// Map Football-Data status to our existing status codes if needed
const mapStatus = (status: string): string => {
    switch (status) {
        case "FINISHED": return "FT";
        case "IN_PLAY": return "1H"; // Simplified
        case "PAUSED": return "HT";
        case "SCHEDULED": return "TBD";
        case "TIMED": return "TBD";
        case "AWARDED": return "FT"; // Counts as finished
        case "POSTPONED": return "PST";
        default: return status;
    }
};

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

    // 1. Fetch News for ALL fixtures in parallel (with limit to avoid rate limits if needed, but Google RSS is usually distinct)
    // For performance, we'll limit to top leagues or just do it. Let's try doing it for all but waiting.
    const fixturesWithNews = await Promise.all(fixtures.map(async (f) => {
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
        You are a cynical, high-stakes football handicapper. Your goal is 80%+ ACCURACY, which means avoiding losses is more important than finding wins.
        
        I have provided REAL-TIME NEWS HEADLINES for these matches. USE THEM. If a star player is out, DOWNGRADE the team.
        
        Step 1: "Devil's Advocate". For every potential bet, ask "How does this lose?". If the risk is >20%, DO NOT mark it as high confidence.
        Step 2: Analyze the match based on Form, Squad News (from headlines), and Value.
        Step 3: Output the prediction.
        
        For each match, return:
        - picked: The prediction.
        - confidence: 0-100%. Max 75% for standard leagues unless news confirms a massive advantage. >85% only for mismatches.
        - reasoning: an ARRAY of 3 points. ONE POINT MUST QUOTE/REFERENCE THE NEWS provided if relevant.
        - type: "result", "goals", or "score".
        - isRisky: true if confidence < 60%.
        - requiresTier: "vip" for your highest confidence picks (>75%), "free" for risky/fun bets.

        Return ONLY a JSON array in this format:
        [{"id": number, "picked": string, "confidence": number, "reasoning": string[], "type": "result"|"goals"|"score", "isRisky": boolean, "requiresTier": string}]
    
        Matches to analyze:
        ${JSON.stringify(fixturesData)}
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

        return fixtures.map(fixture => {
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

    } catch (error) {
        console.error("DeepSeek Analysis Error:", error);
        return fixtures;
    }
};

export const getFixtures = async (
    date: Date,
    sport: Sport = "football",
    showPast: boolean = false,
    forceRefresh: boolean = false
): Promise<Fixture[]> => {
    const dateKey = format(date, "yyyy-MM-dd");
    const nairobiNow = getNairobiNow();

    // 1. Try Firestore Cache (Skip if forceRefresh)
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
