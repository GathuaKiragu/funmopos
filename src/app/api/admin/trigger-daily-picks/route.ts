import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFixtures, getNairobiNow } from '@/lib/api-football';
import { sendTelegramMessage } from '@/lib/telegram-service';
import { sendBulkSMS } from '@/lib/sms-service';
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

        // 2. Format Telegram
        let telegramMessage = `🔥 <b>TODAY’S TIPS – ${displayDate}</b> 🔥\n\n`;
        topPicks.forEach((pick, index) => {
            const home = pick.homeTeam.name;
            const away = pick.awayTeam.name;
            const prediction = pick.prediction?.picked || 'N/A';
            let odds = 'N/A';

            if (pick.latestOdds && pick.latestOdds.length > 0) {
                const mainMarket = pick.latestOdds[0].bets.find(b => b.name === 'Match Winner' || b.name === 'Home/Away');
                if (mainMarket) {
                    const predictionInLower = prediction.toLowerCase();
                    const val = mainMarket.values.find(v =>
                        predictionInLower.includes(v.value.toLowerCase()) ||
                        v.value.toLowerCase().includes(predictionInLower)
                    );
                    if (val) odds = val.odd;
                }
            } else if (pick.openingOdds) {
                const predictionInLower = prediction.toLowerCase();
                if (predictionInLower.includes(home.toLowerCase())) odds = pick.openingOdds.home.toFixed(2);
                else if (predictionInLower.includes(away.toLowerCase())) odds = pick.openingOdds.away.toFixed(2);
                else if (predictionInLower.includes('draw')) odds = pick.openingOdds.draw.toFixed(2);
            }

            telegramMessage += `⚽ Match ${index + 1}:\n`;
            telegramMessage += `<b>${home} vs ${away}</b>\n`;
            telegramMessage += `🧠 Tip: ${prediction}\n`;
            telegramMessage += `📊 Odds: ${odds}\n\n`;
        });

        telegramMessage += `👉 View full analysis & more tips on our site:\n`;
        telegramMessage += `<b>${SITE_URL}</b>\n\n`;
        telegramMessage += `⚠️ Bet smart. Play responsibly.`;

        // 3. Send Telegram
        let telegramResult = { success: false };
        if (!testMode) {
            const res = await sendTelegramMessage(telegramMessage);
            telegramResult.success = res.success;
        } else {
            console.log('[Test Mode] Telegram Message:\n', telegramMessage);
            telegramResult.success = true;
        }

        // 4. Send SMS
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
            sms: { total: usersToNotify.length, sent: smsResult.sent, failed: smsResult.failed }
        });

    } catch (error: any) {
        console.error("Manual Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
