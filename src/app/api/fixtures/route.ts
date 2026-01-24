import { NextResponse } from "next/server";
import { getFixtures, Sport } from "@/lib/api-football";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const sport = (searchParams.get("sport") || "football") as Sport;
    const showPast = searchParams.get("showPast") === "true";

    if (!dateStr) {
        return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
    }

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        // The library already handles Cache Hit -> Cache Miss -> Fetch -> Analyze -> Save
        const fixtures = await getFixtures(date, sport, showPast);

        return NextResponse.json({ fixtures });
    } catch (error: any) {
        console.error("Server API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
