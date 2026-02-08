import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQuotaStatus } from "@/lib/api-football";

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

export async function GET() {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const quota = getQuotaStatus();
        return NextResponse.json(quota);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
