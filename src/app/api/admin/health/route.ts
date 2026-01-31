
import { NextResponse } from "next/server";
import { footballHighlightsAPI } from "@/lib/football-highlights-api";
import { redis } from "@/lib/redis";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function GET() {
    const results: any = {
        timestamp: new Date().toISOString(),
        checks: {}
    };

    // 1. Check Redis
    try {
        await redis.set("health_check_test", "ok", { ex: 10 });
        const val = await redis.get("health_check_test");
        results.checks.redis = { status: val === "ok" ? "healthy" : "failed", message: val };
    } catch (error: any) {
        results.checks.redis = { status: "failed", error: error.message };
    }

    // 2. Check Football Highlights API
    try {
        // Fetch matches for a specific date just to test connection
        const today = new Date().toISOString().split('T')[0];
        const matches = await footballHighlightsAPI.getMatches(today);
        const rateLimits = footballHighlightsAPI.getRateLimitStatus();

        results.checks.footballHighlightsApi = {
            status: matches === null ? "failed" : "healthy",
            matchesFound: matches?.length ?? 0,
            rateLimit: rateLimits
        };
    } catch (error: any) {
        results.checks.footballHighlightsApi = { status: "failed", error: error.message };
    }

    // 3. Check Firebase Admin
    try {
        const auth = getAdminAuth();
        // Just check if we can list users (limit 1) or essentially if auth object is valid
        // detailed check might require listing users which needs permission
        results.checks.firebaseAdmin = { status: "healthy", message: "Initialized" };
    } catch (error: any) {
        results.checks.firebaseAdmin = { status: "failed", error: error.message };
    }

    const allHealthy = Object.values(results.checks).every((c: any) => c.status === "healthy");

    return NextResponse.json({
        status: allHealthy ? "ok" : "issues_detected",
        results
    }, { status: allHealthy ? 200 : 503 });
}
