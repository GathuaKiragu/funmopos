import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { syncAllFixtures } from "@/lib/api-football";

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

        const { days = 2 } = await request.json(); // Default to today and tomorrow

        console.log(`[API] Manual Sync Triggered for ${days} days`);
        await syncAllFixtures(days);

        return NextResponse.json({
            message: "Sync successful",
            analyzedDays: days,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
