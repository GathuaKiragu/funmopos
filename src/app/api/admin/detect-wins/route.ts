import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    limit,
    orderBy
} from "firebase/firestore";
import { getResult } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/telegram-service";
import { postToX, postToFacebook } from "@/lib/social-media-service";
import { format } from "date-fns";

export async function POST(request: Request) {
    try {
        const { secret } = await request.json();
        if (secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[WinDetector] Running detection for last 24 hours...");

        // 1. Get finished matches from the last 2 days that haven't been posted
        // We look at the last 2 days to catch late-night games
        const fixturesRef = collection(db, "fixtures");
        const q = query(
            fixturesRef,
            where("status.short", "in", ["FT", "AET", "PEN"]),
            where("socialPosted", "==", false),
            limit(10) // Process in small batches
        );

        const querySnapshot = await getDocs(q);
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

Data-driven precision. Join the winning team at funmotips.com
#FunmoTips #FootballPredictions #Winner #SportsBetting
                `.trim();

                // Post to social media
                const telegram = await sendTelegramMessage(message);

                // For Twitter/FB, remove HTML tags
                const plainText = message.replace(/<[^>]*>/g, '');
                const xPost = await postToX(plainText);
                const fbPost = await postToFacebook(plainText);

                // Mark as posted regardless of success to avoid spamming on partial failures
                await updateDoc(doc(db, "fixtures", docSnap.id), {
                    socialPosted: true,
                    socialPostedAt: Date.now()
                });

                results.push({
                    id: fixture.id,
                    match: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                    posted: { telegram, x: xPost, facebook: fbPost }
                });
            } else if (result === 'LOST' || result === 'VOID') {
                // Also mark as posted if lost, so we don't check again
                await updateDoc(doc(db, "fixtures", docSnap.id), {
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
