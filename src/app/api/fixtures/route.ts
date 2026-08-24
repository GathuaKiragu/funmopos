import { NextResponse } from "next/server";
import { getFixtures, Sport, getQuotaStatus } from "@/lib/api-football";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const sport = (searchParams.get("sport") || "football") as Sport;
    const showPast = searchParams.get("showPast") === "true";
    // Public reads must never force ingestion or analysis. Operators use protected
    // admin/cron routes for refreshes.
    const refresh = false;

    if (!dateStr) {
        return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
    }

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        // The library already handles Cache Hit -> Cache Miss -> Fetch -> Analyze -> Save
        const fixtures = await getFixtures(date, sport, showPast, refresh);
        const quota = getQuotaStatus();

        return NextResponse.json({ fixtures, quota }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
    } catch (error: any) {
        console.error("Server API Error:", error);
        return NextResponse.json({ error: "Unable to load fixtures" }, { status: 500 });
    }
}
