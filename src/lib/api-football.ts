import { format, subDays, addDays, isPast, addHours } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import axios from "axios";

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
    prediction?: {
        picked: string;
        confidence: number;
        reasoning: string;
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
const COMPETITIONS = ["PL", "ELC", "PD", "SA", "BL1", "FL1", "DED", "PPL"];

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
                // Removed competitions param to ensure we get everything the token has access to
            },
            headers: {
                'X-Auth-Token': API_KEY
            }
        });

        const rawMatches = response.data.matches;
        if (!rawMatches || !Array.isArray(rawMatches)) return [];

        console.log(`[API Response] Received ${rawMatches.length} total matches from API`);

        // Filter and map matches
        const filteredFixtures = rawMatches
            .filter((match: any) => {
                // Filter by competition code
                if (!COMPETITIONS.includes(match.competition.code)) {
                    return false;
                }

                // Filter by Nairobi date
                const utcDate = new Date(match.utcDate);
                const nairobiDate = new Date(utcDate.getTime() + (3 * 3600000));
                const nairobiDateString = format(nairobiDate, "yyyy-MM-dd");
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
                prediction: null
            }));

        console.log(`[Filtered] ${filteredFixtures.length} matches for ${targetDateKey} after filtering`);
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
        default: return status;
    }
};

// AI Analysis with DeepSeek
const analyzeFixtures = async (fixtures: Fixture[]): Promise<Fixture[]> => {
    if (!DEEPSEEK_KEY || fixtures.length === 0) return fixtures;

    const fixturesData = fixtures.map(f => ({
        id: f.id,
        sport: f.sport,
        home: f.homeTeam.name,
        away: f.awayTeam.name,
        league: f.league.name
    }));

    const prompt = `
        You are a professional ${fixtures[0].sport} analyst. Analyze the following matches and provide betting predictions.
        For each match, return:
        - picked: The predicted result (e.g., "Arsenal Win", "Over 2.5 Goals", "Draw")
        - confidence: A percentage (0-100) representing your confidence in the tip.
        - reasoning: A short, punchy explanation (max 15 words) of WHY this prediction was made (e.g., "Home team unbeaten in 5", "Key striker injured").
        - type: One of "result", "goals", or "score".
        - isRisky: Boolean, true if confidence is below 40%.
        - requiresTier: "free", "basic", "standard", or "vip". (Assign "vip" for high confidence top league matches, "free" for clear favorites).

        Return ONLY a JSON array in this format:
        [{"id": number, "picked": string, "confidence": number, "reasoning": string, "type": "result"|"goals"|"score", "isRisky": boolean, "requiresTier": string}]

        Matches to analyze:
        ${JSON.stringify(fixturesData)}
    `;

    try {
        const response = await axios.post(DEEPSEEK_URL, {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a football betting expert. Respond only with JSON." },
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
                        reasoning: pred.reasoning || "AI analysis based on recent form and stats.", // Fallback
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

    // 2. Cache Miss -> Real API
    if (fixtures.length === 0) {
        console.log(`[Cache Miss] Fetching from API for ${sport} on ${dateKey}`);
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
    if (!showPast) {
        return fixtures.filter(f => {
            const matchDate = new Date(f.date);
            // Simpler check: Match start time vs real current time
            // Both are global/UTC timestamps, so it works anywhere
            return matchDate.getTime() > (new Date().getTime() - (15 * 60000));
        });
    }

    return fixtures;
};

/**
 * Client-safe version of getFixtures that calls our internal API route.
 * Use this in components (useEffect) to avoid exposing keys or direct Firestore writes.
 */
export const getFixturesClient = async (date: Date, sport: Sport = "football", showPast: boolean = false): Promise<Fixture[]> => {
    try {
        const dateStr = format(date, "yyyy-MM-dd");
        const response = await axios.get(`/api/fixtures?date=${dateStr}&sport=${sport}&showPast=${showPast}`);
        return response.data.fixtures || [];
    } catch (err) {
        console.error("Client Fetch Error:", err);
        return [];
    }
};

/**
 * Proactively syncs and analyzes fixtures for the next N days.
 * This should be called by an automated job (cron).
 */
export const syncAllFixtures = async (days: number = 7): Promise<void> => {
    const nairobiNow = getNairobiNow();
    console.log(`[Sync Started] Current Nairobi Time: ${format(nairobiNow, "yyyy-MM-dd HH:mm")}`);
    console.log(`Proactively analyzing next ${days} days...`);

    const sports: Sport[] = ["football"];

    for (const sport of sports) {
        for (let i = 0; i < days; i++) {
            const targetDate = addDays(nairobiNow, i);
            const dateKey = format(targetDate, "yyyy-MM-dd");
            console.log(`--- Syncing ${sport} for ${dateKey} ---`);
            // We use forceRefresh=true to ensures we pick up any new matches recently added to API
            await getFixtures(targetDate, sport, true, true);
        }
    }
    console.log("[Sync Completed]");
};
