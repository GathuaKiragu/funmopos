
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { format, subDays } from "date-fns";
import { Fixture, getNairobiNow } from "@/lib/api-football";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam) : 7;

    // Validate days
    if (days < 1 || days > 30) {
        return NextResponse.json({ error: "Days must be between 1 and 30" }, { status: 400 });
    }

    try {
        const nairobiNow = getNairobiNow();
        const dateKeys: string[] = [];

        // Generate date keys for the past 'days' (excluding today to ensure we focus on finished days mostly, 
        // or finding today's finished matches is fine too. Let's include today.)
        // Actually, for "Past games", usually implies yesterday backwards, but including today if finished is good.
        for (let i = 0; i < days; i++) {
            const d = subDays(nairobiNow, i);
            dateKeys.push(format(d, "yyyy-MM-dd"));
        }

        // Fetch in parallel
        const promises = dateKeys.map(async (dateKey) => {
            const q = query(
                collection(db, "fixtures"),
                where("dateKey", "==", dateKey),
                where("sport", "==", "football") // defaulting to football for now
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => d.data() as Fixture);
        });

        const resultsArrays = await Promise.all(promises);
        const allFixtures = resultsArrays.flat();

        // Filter for finished games with predictions
        const finishedFixtures = allFixtures.filter(f => {
            const isFinished = ['FT', 'AET', 'PEN'].includes(f.status.short);
            const hasPrediction = !!f.prediction;
            return isFinished && hasPrediction;
        });

        // Sort by date descending (newest first)
        finishedFixtures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ fixtures: finishedFixtures });
    } catch (error: any) {
        console.error("Performance API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
