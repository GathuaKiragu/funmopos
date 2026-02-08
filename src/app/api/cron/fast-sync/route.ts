import { NextResponse } from "next/server";
import { getFixtures, getNairobiNow } from "@/lib/api-football";
import { addDays, format } from "date-fns";

export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Fast Sync] Starting score/status update...");

        const nairobiNow = getNairobiNow();
        const datesToSync = [
            nairobiNow, // Today
            addDays(nairobiNow, -1) // Yesterday (to finalize scores)
        ];

        for (const date of datesToSync) {
            const dateStr = format(date, "yyyy-MM-dd");
            console.log(`[Fast Sync] Refreshing ${dateStr} statuses...`);
            // We use statusOnly=true to avoid AI analysis
            await getFixtures(date, "football", true, true, true);
        }

        return NextResponse.json({ success: true, message: "Fast sync completed" });

    } catch (error: any) {
        console.error("[Fast Sync] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
