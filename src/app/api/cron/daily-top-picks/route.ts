import { NextResponse } from 'next/server';
import { getFixtures, getNairobiNow } from '@/lib/api-football';
import { sendTelegramMessage } from '@/lib/telegram-service';
import { sendBulkSMS, formatPhoneNumber } from '@/lib/sms-service';
import { postToX, postToFacebook } from '@/lib/social-media-service';
import { getAdminDb } from '@/lib/firebase-admin';
import { format } from 'date-fns';

// Configuration
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://funmotips.africa';
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // 1. Verify Cron Secret (if configured)
        const secret = searchParams.get('secret');
        const testMode = searchParams.get('test') === 'true';

        if (!testMode && CRON_SECRET && secret !== CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = getNairobiNow();
        const dateStr = format(now, 'yyyy-MM-dd');
        const displayDate = format(now, 'do MMMM yyyy');

        // 2. Fetch today's fixtures
        // We forceRefresh=true because this is an automated morning job 
        // that needs to ensure matches are fetched and analyzed for the day.
        const fixtures = await getFixtures(now, 'football', false, true);

        if (!fixtures || fixtures.length === 0) {
            return NextResponse.json({ message: 'No fixtures found for today' });
        }

        // 3. Selection Logic (Top 2-3 picks with highest confidence)
        const topPicks = fixtures
            .filter(f => f.prediction && f.prediction.confidence >= 75)
            .sort((a, b) => (b.prediction?.confidence || 0) - (a.prediction?.confidence || 0))
            .slice(0, 2); // Taking top 2 as per template example

        if (topPicks.length === 0) {
            return NextResponse.json({ message: 'No high confidence picks found for today' });
        }

        // 4. Generate Image URL
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
                odds: odds,
                confidence: p.prediction?.confidence || 0
            };
        });

        const imageUrl = `${SITE_URL}/api/og/picks?date=${encodeURIComponent(displayDate)}&picks=${encodeURIComponent(JSON.stringify(picksForImage))}`;
        console.log('[Daily Cron] Generated Image URL:', imageUrl);

        // 5. Format Telegram Message
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

        // 6. Send Telegram
        let telegramResult: { success: boolean; error?: string } = { success: false, error: 'Test Mode' };
        if (!testMode) {
            // Use sendTelegramPhoto instead of sendMessage
            const { sendTelegramPhoto } = await import('@/lib/telegram-service');
            const res = await sendTelegramPhoto(telegramMessage, imageUrl);
            telegramResult = { success: res.success, error: typeof res.error === 'string' ? res.error : JSON.stringify(res.error) };
        } else {
            console.log('[Test Mode] Telegram Message:\n', telegramMessage);
            telegramResult = { success: true };
        }

        // 7. Format Social Media Message (Shorter for X)
        const socialMessage = `🔥 Today's Top Betting Picks are Live! 🔥\n\n` +
            topPicks.map(p => `⚽ ${p.homeTeam.name} vs ${p.awayTeam.name}`).join('\n') +
            `\n\nCheck full analysis here: ${SITE_URL}\n\n#BettingTips #Football #FunmoTips`;

        // 8. Send Social Media
        let xResult = { success: false, error: 'Test Mode' };
        let fbResult = { success: false, error: 'Test Mode' };

        if (!testMode) {
            const { postToXWithMedia } = await import('@/lib/social-media-service');

            // Post to X with Image
            const xRes = await postToXWithMedia(socialMessage, imageUrl);

            // Post to FB with Image
            const fbRes = await postToFacebook(socialMessage, imageUrl);

            xResult = { success: xRes.success, error: xRes.error || '' };
            fbResult = { success: fbRes.success, error: fbRes.error || '' };
        } else {
            console.log('[Test Mode] Social Media Message:\n', socialMessage);
            xResult = { success: true, error: '' };
            fbResult = { success: true, error: '' };
        }

        // 6. Fetch Users for SMS
        const db = getAdminDb();
        const usersSnapshot = await db.collection('users').get();
        const smsTasks: Promise<any>[] = [];

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const phoneNumber = userData.phoneNumber;
            const displayName = userData.displayName || 'Friend';

            if (phoneNumber) {
                const smsMessage = `Hi ${displayName},\nToday’s betting tips are now live.\nDon’t miss today’s picks\n\n${SITE_URL}`;
                // We use the existing sendBulkSMS logic but potentially wrapped or single
                // Actually sendBulkSMS handles the array, let's collect and send all at once
                smsTasks.push(Promise.resolve({ phoneNumber, displayName }));
            }
        });

        const usersToNotify = await Promise.all(smsTasks);
        const phoneNumbers = usersToNotify.map(u => u.phoneNumber);

        let smsResult = { totalSent: 0, totalFailed: 0 };
        if (phoneNumbers.length > 0) {
            // Note: sendBulkSMS in sms-service.ts takes (phoneNumbers[], message, batchSize)
            // But we need to personalize the "Hi {Brian}" part.
            // If we want personalization, we MUST send individually or use a placeholder system if the SMS provider supports it.
            // SasaSignal might not support placeholders in bulk easily through the current implementation.

            // Re-implementing personalized bulk send here
            // Actually, let's use a non-personalized bulk message if there are too many users, 
            // but the user SPECIFICALLY asked for "Hi {Brian}".

            if (testMode) {
                let loggedCount = 0;
                for (const user of usersToNotify) {
                    if (loggedCount >= 3) break; // Only log first 3 in test
                    console.log(`[Test Mode] SMS for ${user.displayName} (${user.phoneNumber}): Hi ${user.displayName},\nToday’s betting tips are now live.\nDon’t miss today’s picks\n\n${SITE_URL}`);
                    smsResult.totalSent++;
                    loggedCount++;
                }
            } else {
                // Let's send in batches of 50 to avoid API rate limits
                const batchSize = 50;
                for (let i = 0; i < usersToNotify.length; i += batchSize) {
                    const batch = usersToNotify.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (user) => {
                        const msg = `Hi ${user.displayName},\nToday’s betting tips are now live.\nDon’t miss today’s picks\n\n${SITE_URL}`;
                        const res = await sendBulkSMS([user.phoneNumber], msg); // sendBulkSMS with 1 number is safe
                        if (res.totalSent > 0) smsResult.totalSent++;
                        else smsResult.totalFailed++;
                    }));
                    if (i + batchSize < usersToNotify.length) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            telegram: telegramResult.success,
            social: {
                x: xResult.success,
                facebook: fbResult.success
            },
            sms: {
                totalRecipients: usersToNotify.length,
                sent: smsResult.totalSent,
                failed: smsResult.totalFailed
            },
            picksCount: topPicks.length
        });

    } catch (error: any) {
        console.error('Daily Automation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
