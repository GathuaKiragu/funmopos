import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

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

        const { protocol, host } = new URL(request.url);
        const baseUrl = `${protocol}//${host}`;

        // Trigger the internal fast-sync cron route
        const url = `${baseUrl}/api/cron/fast-sync?secret=${CRON_SECRET}`;

        console.log('Triggering Fast Sync:', url);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${CRON_SECRET}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            return NextResponse.json(data);
        } else {
            return NextResponse.json({ error: data.error || "Failed to trigger" }, { status: response.status });
        }

    } catch (error: any) {
        console.error("Manual Fast Sync Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
