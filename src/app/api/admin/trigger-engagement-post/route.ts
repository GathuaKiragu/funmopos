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

        const { searchParams, protocol, host } = new URL(request.url);
        const testMode = searchParams.get('test') === 'true';

        // Use the current host to avoid hitting production when testing locally
        const baseUrl = `${protocol}//${host}`;
        const url = `${baseUrl}/api/cron/social-engagement?secret=${CRON_SECRET}&force=true${testMode ? '&test=true' : ''}`;

        console.log('Triggering internal URL:', url);
        const response = await fetch(url);

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse JSON response. Body starts with:', text.substring(0, 100));
            return NextResponse.json({
                error: "Internal API did not return JSON",
                status: response.status,
                preview: text.substring(0, 200)
            }, { status: 500 });
        }

        if (response.ok) {
            return NextResponse.json(data);
        } else {
            return NextResponse.json({ error: data.error || "Failed to trigger" }, { status: response.status });
        }

    } catch (error: any) {
        console.error("Manual Engagement Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
