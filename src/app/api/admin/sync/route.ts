import { NextResponse } from "next/server";
import { syncAllFixtures } from "@/lib/api-football";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    // Simple security check
    if (key !== process.env.ADMIN_SYNC_KEY && process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[API] Manual Sync Triggered");
        await syncAllFixtures(7); // Sync next 7 days
        return NextResponse.json({ message: "Sync successful", analyzedDays: 7 });
    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
