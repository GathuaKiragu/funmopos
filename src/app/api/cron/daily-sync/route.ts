import { NextResponse } from "next/server";
import { syncAllFixtures } from "@/lib/api-football";

export const maxDuration = 300; // 5 minutes max execution time

export async function GET(request: Request) {
    try {
        // Verify the request is from Vercel Cron
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error("CRON_SECRET not configured");
            return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            console.error("Unauthorized cron request");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Daily Cron] Starting fixture sync at", new Date().toISOString());

        // Sync today + next 2 days (3 days total)
        await syncAllFixtures(3, 0);

        console.log("[Daily Cron] Sync completed successfully");

        return NextResponse.json({
            success: true,
            message: "Daily sync completed",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("[Daily Cron] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
