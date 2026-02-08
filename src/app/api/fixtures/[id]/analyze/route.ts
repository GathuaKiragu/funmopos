import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { analyzeFixtures, Fixture, getNairobiNow } from "@/lib/api-football";
import { format } from "date-fns";
import { cookies } from "next/headers";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { dateKey } = await request.json();

        if (!id || !dateKey) {
            return NextResponse.json({ error: "Missing ID or dateKey" }, { status: 400 });
        }

        console.log(`[Manual Analysis] Request received for fixture ${id} on ${dateKey}`);

        // 1. Fetch the existing fixture from Firestore
        const docRef = doc(db, "fixtures", `football-${dateKey}-${id}`);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            return NextResponse.json({ error: "Fixture not found in cache" }, { status: 404 });
        }

        const fixture = snap.data() as Fixture;

        // 2. Perform AI Analysis (Single item)
        const analyzedFixtures = await analyzeFixtures([fixture], true);

        if (analyzedFixtures.length > 0) {
            const analyzed = analyzedFixtures[0];
            // 3. Save back to Firestore
            await setDoc(docRef, { ...analyzed, dateKey }, { merge: true });
            return NextResponse.json({ success: true, fixture: analyzed });
        }

        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });

    } catch (error: any) {
        console.error("[Manual Analysis] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
