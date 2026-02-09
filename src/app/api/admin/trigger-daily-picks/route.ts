import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFixtures, getNairobiNow } from '@/lib/api-football';
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram-service';
import { sendBulkSMS } from '@/lib/sms-service';
import { postToX, postToFacebook, postToXWithMedia } from '@/lib/social-media-service';
import { getAdminDb } from '@/lib/firebase-admin';
import { format } from 'date-fns';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://funmotips.africa';

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

        const { searchParams } = new URL(request.url);
        const testMode = searchParams.get('test') === 'true';

        console.log(`[API] Manual Daily Picks Triggered (testMode: ${testMode})`);

        const now = getNairobiNow();
        const displayDate = format(now, 'do MMMM yyyy');

        // 1. Fetch & Refresh
        const fixtures = await getFixtures(now, 'football', false, true);

        if (!fixtures || fixtures.length === 0) {
            return NextResponse.json({ message: 'No fixtures found for today' });
        }

        const topPicks = fixtures
            .filter(f => f.prediction && f.prediction.confidence >= 75)
            .sort((a, b) => (b.prediction?.confidence || 0) - (a.prediction?.confidence || 0))
            .slice(0, 2);

        if (topPicks.length === 0) {
            return NextResponse.json({ message: 'No high confidence picks found for today' });
        }

        // 2. Generate Image URL
        const picksForImage = topPicks.map(p => {
            let odds = 'N/A';
            const prediction = p.prediction?.picked || 'N/A';

            if (p.latestOdds && p.latestOdds.length > 0) {
                const mainMarket = p.latestOdds[0].bets.find(b => b.name === 'Match Winner' || b.name === 'Home/Away');
                if (mainMarket) {
                    const predictionInLower = prediction.toLowerCase();
                    const val = mainMarket.values.find(v =>
                        predictionInLower.includes(v.value.toLowerCase()) ||
                        v.value.toLowerCase().includes(predictionInLower)
                    );
                    if (val) odds = val.odd;
                }
            } else if (p.openingOdds) {
                const home = p.homeTeam.name;
                const away = p.awayTeam.name;
                const predictionInLower = prediction.toLowerCase();
                if (predictionInLower.includes(home.toLowerCase())) odds = p.openingOdds.home.toFixed(2);
                else if (predictionInLower.includes(away.toLowerCase())) odds = p.openingOdds.away.toFixed(2);
                else if (predictionInLower.includes('draw')) odds = p.openingOdds.draw.toFixed(2);
            }

            return {
                home: p.homeTeam.name,
                away: p.awayTeam.name,
                tip: prediction,
                odds: odds
            };
        });

        const imageUrl = `${SITE_URL}/api/og/picks?date=${encodeURIComponent(displayDate)}&picks=${encodeURIComponent(JSON.stringify(picksForImage))}`;
        console.log('[Manual Trigger] Generated Image URL:', imageUrl);

        // 3. Format Telegram
        let telegramMessage = `🔥 <b>TODAY’S TIPS – ${displayDate}</b> 🔥\n\n`;
        topPicks.forEach((pick, index) => {
            const home = pick.homeTeam.name;
            const away = pick.awayTeam.name;
            const prediction = pick.prediction?.picked || 'N/A';
            const odds = picksForImage[index].odds;

            telegramMessage += `⚽ Match ${index + 1}:\n`;
            telegramMessage += `<b>${home} vs ${away}</b>\n`;
            telegramMessage += `🧠 Tip: ${prediction}\n`;
            telegramMessage += `📊 Odds: ${odds}\n\n`;
        });

        telegramMessage += `👉 View full analysis & more tips on our site:\n`;
        telegramMessage += `<b>${SITE_URL}</b>\n\n`;
        telegramMessage += `⚠️ Bet smart. Play responsibly.`;

        // 4. Send Telegram
        let telegramResult: { success: boolean; error?: string } = { success: false };
        if (!testMode) {
            const res = await sendTelegramPhoto(telegramMessage, imageUrl);
            telegramResult = { success: res.success, error: typeof res.error === 'string' ? res.error : JSON.stringify(res.error) };
        } else {
            console.log('[Test Mode] Telegram Message:\n', telegramMessage);
            console.log('[Test Mode] Telegram Image:', imageUrl);
            telegramResult.success = true;
        }

        // 5. Send Social Media
        const socialMessage = `🔥 Today's Top Betting Picks are Live! 🔥\n\n` +
            topPicks.map(p => `⚽ ${p.homeTeam.name} vs ${p.awayTeam.name}`).join('\n') +
            `\n\nCheck full analysis here: ${SITE_URL}\n\n#BettingTips #Football #FunmoTips`;

        let xResult = { success: false, error: '' };
        let fbResult = { success: false, error: '' };

        if (!testMode) {
            // Post to X with Image
            const xRes = await postToXWithMedia(socialMessage, imageUrl);

            // Post to FB with Image
            const fbRes = await postToFacebook(socialMessage, imageUrl);

            xResult = { success: xRes.success, error: xRes.error || '' };
            fbResult = { success: fbRes.success, error: fbRes.error || '' };
        } else {
            console.log('[Test Mode] Social Media Message:\n', socialMessage);
            console.log('[Test Mode] Social Image:', imageUrl);
            xResult.success = true;
            fbResult.success = true;
        }

        // 6. Send SMS
        const db = getAdminDb();
        const usersSnapshot = await db.collection('users').get();
        let smsResult = { sent: 0, failed: 0 };

        const usersToNotify: any[] = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.phoneNumber) {
                usersToNotify.push({ phoneNumber: data.phoneNumber, displayName: data.displayName || 'Friend' });
            }
        });

        if (testMode) {
            smsResult.sent = Math.min(usersToNotify.length, 3);
        } else {
            // Use batched sending to avoid overwhelming the provider or timeouts
            const batchSize = 50;
            for (let i = 0; i < usersToNotify.length; i += batchSize) {
                const batch = usersToNotify.slice(i, i + batchSize);
                await Promise.all(batch.map(async (user) => {
                    const msg = `Hi ${user.displayName},\nToday’s betting tips are now live.\nDon’t miss today’s picks\n\n${SITE_URL}`;
                    const res = await sendBulkSMS([user.phoneNumber], msg);
                    if (res.totalSent > 0) smsResult.sent++;
                    else smsResult.failed++;
                }));
                if (i + batchSize < usersToNotify.length) await new Promise(r => setTimeout(r, 1000));
            }
        }

        return NextResponse.json({
            success: true,
            telegram: telegramResult.success,
            social: { x: xResult.success, facebook: fbResult.success },
            sms: { total: usersToNotify.length, sent: smsResult.sent, failed: smsResult.failed }
        });

    } catch (error: any) {
        console.error("Manual Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

