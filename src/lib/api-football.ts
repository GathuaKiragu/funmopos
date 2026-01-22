import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc, getDoc } from "firebase/firestore";
import axios from "axios";

export interface Fixture {
    id: number;
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
        elapsed?: number;
    };
    prediction?: {
        picked: string;
        confidence: number;
        type: "result" | "goals" | "score";
        isRisky: boolean;
        requiresTier: "free" | "basic" | "standard" | "vip";
    } | null;
}

const API_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

// Fetch from API-Football
const fetchFromApi = async (date: Date): Promise<Fixture[]> => {
    if (!API_KEY) {
        console.error("Missing API_FOOTBALL_KEY");
        return [];
    }

    // We fetch for "Today" -> Date
    const formattedDate = format(date, "yyyy-MM-dd");

    try {
        // Preferred Leagues: Premier League (39), La Liga (140), Serie A (135), Bundesliga (78), Ligue 1 (61)
        // We can add more or make this dynamic.
        const PREFERRED_LEAGUES = [39, 140, 135, 78, 61];

        const response = await axios.get(`${BASE_URL}/fixtures`, {
            params: {
                date: formattedDate,
                timezone: "Africa/Nairobi"
            },
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            }
        });

        const rawData = response.data.response;

        if (!rawData || !Array.isArray(rawData)) return [];

        const fixtures: Fixture[] = rawData
            .filter((item: any) => PREFERRED_LEAGUES.includes(item.league.id))
            .map((item: any) => ({
                id: item.fixture.id,
                league: {
                    name: item.league.name,
                    logo: item.league.logo,
                    flag: item.league.flag
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
                    short: item.fixture.status.short,
                    elapsed: item.fixture.status.elapsed
                },
                prediction: null // Initialize as null. AI/Admin must populate this.
            }));

        return fixtures;

    } catch (error) {
        console.error("API Fetch Error:", error);
        return [];
    }
};

export const getFixtures = async (date: Date): Promise<Fixture[]> => {
    const dateKey = format(date, "yyyy-MM-dd");

    // 1. Try Firestore Cache
    try {
        const q = query(collection(db, "fixtures"), where("dateKey", "==", dateKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            console.log(`[Cache Hit] Serving ${querySnapshot.size} fixtures for ${dateKey}`);
            return querySnapshot.docs.map(doc => doc.data() as Fixture);
        }
    } catch (err) {
        console.error("Cache Read Error", err);
    }

    // 2. Cache Miss -> Real API
    console.log(`[Cache Miss] Fetching from API-Football for ${dateKey}`);
    const freshFixtures = await fetchFromApi(date);

    if (freshFixtures.length > 0) {
        try {
            const batch = writeBatch(db);
            freshFixtures.forEach(fixture => {
                const docRef = doc(db, "fixtures", `${dateKey}-${fixture.id}`);
                batch.set(docRef, { ...fixture, dateKey });
            });
            await batch.commit();
            console.log(`[Cache Update] Saved ${freshFixtures.length} matches.`);
        } catch (err) {
            console.error("Cache Write Error", err);
        }
    }

    return freshFixtures;
};
