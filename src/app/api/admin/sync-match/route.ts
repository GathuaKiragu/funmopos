import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchFromApi, analyzeFixtures, isCoreLeague } from "@/lib/api-football";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

export async function POST(request: Request) {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { fixtureId, dateKey } = await request.json();

        if (!fixtureId || !dateKey) {
            return NextResponse.json({ error: "Missing fixtureId or dateKey" }, { status: 400 });
        }

        console.log(`[API] Manual Match Analysis Triggered: ${fixtureId} (${dateKey})`);

        // 1. Fetch the specific fixture from API
        // Note: fetchFromApi takes a Date, but since we have dateKey, we can construct it
        const targetDate = new Date(dateKey);
        const allFixtures = await fetchFromApi(targetDate);
        const fixture = allFixtures.find((f: any) => f.id === fixtureId);

        if (!fixture) {
            return NextResponse.json({ error: "Fixture not found in API" }, { status: 404 });
        }

        // 2. Perform AI Analysis
        // analyzeFixtures takes an array
        const analyzed = await analyzeFixtures([fixture]);
        const result = analyzed[0];

        // 3. Save to Firestore
        const docRef = doc(db, "fixtures", `football-${dateKey}-${fixtureId}`);
        await setDoc(docRef, { ...result, dateKey, sport: "football", socialPosted: false }, { merge: true });

        return NextResponse.json({
            success: true,
            fixture: result
        });

    } catch (error: any) {
        console.error("Single Match Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
