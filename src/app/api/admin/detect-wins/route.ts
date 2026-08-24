import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get("admin_session");
    return !!session;
}

export async function POST(request: Request) {
    try {
        const isAdmin = await verifyAdmin();
        const authHeader = request.headers.get("authorization");
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get("secret");

        const isCronAuthorized = CRON_SECRET && (secret === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`);

        if (!isAdmin && !isCronAuthorized) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { protocol, host } = new URL(request.url);
        const baseUrl = `${protocol}//${host}`;
        const url = `${baseUrl}/api/cron/detect-wins?secret=${CRON_SECRET}`;

        console.log("Triggering internal Detect Wins Cron:", url);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CRON_SECRET}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error("Admin Detect Wins Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    return POST(request);
}
