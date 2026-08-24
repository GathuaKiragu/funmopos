import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getResult } from "@/lib/utils";
import { postToFacebook } from "@/lib/social-media-service";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://funmotips.africa';

async function run(request: Request, suppliedSecret?: string | null) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = suppliedSecret || searchParams.get("secret");
        const authHeader = request.headers.get("authorization");

        if (!CRON_SECRET || (secret !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[WinDetector] Running detection for finished matches...");

        // 1. Get finished matches that haven't been posted yet
        const querySnapshot = await getAdminDb().collection("fixtures")
            .where("status.short", "in", ["FT", "AET", "PEN"])
            .where("socialPosted", "==", false)
            .limit(10)
            .get();

        const results = [];

        for (const docSnap of querySnapshot.docs) {
            const fixture = docSnap.data() as any;
            const prediction = fixture.prediction;

            if (!prediction) continue;

            const result = getResult(prediction, fixture);

            if (result === 'WON') {
                console.log(`[WinDetector] Found winner: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`);

                // Construct winner message
                const message = `
🔥 <b>BOOOOM! WINNER DETECTED!</b> 🔥

🏆 ${fixture.league.name}
⚽️ ${fixture.homeTeam.name} ${fixture.goals.home} - ${fixture.goals.away} ${fixture.awayTeam.name}

✅ <b>Pick:</b> ${prediction.picked}
📈 <b>Confidence:</b> ${prediction.confidence}%
💰 <b>Status:</b> WON

Data-driven precision. Join the winning team at ${SITE_URL}
#FunmoTips #FootballPredictions #Winner #SportsBetting
                `.trim();

                // Generate Win Image
                const picksForImage = [{
                    home: fixture.homeTeam.name,
                    away: fixture.awayTeam.name,
                    tip: prediction.picked,
                    odds: "WON"
                }];
                const imageUrl = `${SITE_URL}/api/og/picks?date=Winner&picks=${encodeURIComponent(JSON.stringify(picksForImage))}`;

                console.log(`[WinDetector] Generated Image URL: ${imageUrl}`);

                // Post to Telegram with Photo
                const { sendTelegramPhoto } = await import("@/lib/telegram-service");
                const telegram = await sendTelegramPhoto(message, imageUrl);

                // For Twitter/FB, remove HTML tags
                const plainText = message.replace(/<[^>]*>/g, '');

                const { postToXWithMedia } = await import("@/lib/social-media-service");
                const xPost = await postToXWithMedia(plainText, imageUrl);

                // FB supports image URL directly
                const fbPost = await postToFacebook(plainText, imageUrl);

                // Mark as posted regardless of success to avoid spamming on partial failures
                await docSnap.ref.update({
                    socialPosted: true,
                    socialPostedAt: Date.now()
                });

                results.push({
                    id: fixture.id,
                    match: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                    posted: { telegram: telegram.success, x: xPost.success, facebook: fbPost.success }
                });
            } else if (result === 'LOST' || result === 'VOID') {
                // Also mark as posted if lost/void, so we don't check again
                await docSnap.ref.update({
                    socialPosted: true
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error("[WinDetector] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    return run(request);
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    return run(request, body?.secret);
}
