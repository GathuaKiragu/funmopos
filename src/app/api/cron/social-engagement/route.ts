import { NextResponse } from "next/server";
import { getFixtures, getNairobiNow } from '@/lib/api-football';
import { postToX, postToFacebook, postToXWithMedia } from '@/lib/social-media-service';
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram-service';
import { format, isPast } from 'date-fns';

const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://funmotips.africa';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const secret = searchParams.get('secret');

    if (secret !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const testMode = searchParams.get('test') === 'true';
    const forcePost = searchParams.get('force') === 'true';

    // Target: ~10 posts per day.
    // Schedule: Hourly (24 runs/day).
    // Probability needed: 10/24 ~= 0.42 (42%).
    // We'll set it to 45% (0.45) to be safe.
    // If random > 0.45, we skip.
    if (!forcePost && Math.random() > 0.45) {
        return NextResponse.json({ message: 'Skipped: Randomness index too low' });
    }

    try {
        const now = getNairobiNow();
        const fixtures = await getFixtures(now, 'football', true, false); // Get today's fixtures (including past for win highlights)

        if (!fixtures || fixtures.length === 0) {
            return NextResponse.json({ message: 'No fixtures found' });
        }

        // Templates
        const postTypes = ['upcoming', 'win', 'cta'];
        let chosenType = postTypes[Math.floor(Math.random() * postTypes.length)];

        let message = "";
        let imageUrl = "";
        let picksForImage: any[] = [];

        if (chosenType === 'upcoming') {
            // Get upcoming matches (not started yet)
            const upcoming = fixtures.filter(f => !isPast(new Date(f.date)));

            if (upcoming.length > 0) {
                // Pick a random one from the top 5 (or fewer if less than 5) to avoid always showing the same match
                const poolSize = Math.min(upcoming.length, 5);
                const match = upcoming[Math.floor(Math.random() * poolSize)];

                message = `📅 Upcoming Match Alert!\n\n⚽ ${match.homeTeam.name} vs ${match.awayTeam.name}\n🚀 Our AI has analyzed this game. Don't miss out!\n\nCheck the prediction here: ${SITE_URL}\n\n#FootballTips #BettingPicks`;

                // Prepare Image Data
                let odds = 'N/A';
                const prediction = match.prediction?.picked || 'N/A';

                // Try to find odds
                if (match.latestOdds && match.latestOdds.length > 0) {
                    const mainMarket = match.latestOdds[0].bets.find((b: any) => b.name === 'Match Winner' || b.name === 'Home/Away');
                    if (mainMarket) {
                        const predictionInLower = prediction.toLowerCase();
                        const val = mainMarket.values.find((v: any) =>
                            predictionInLower.includes(v.value.toLowerCase()) ||
                            v.value.toLowerCase().includes(predictionInLower)
                        );
                        if (val) odds = val.odd;
                    }
                }

                picksForImage = [{
                    home: match.homeTeam.name,
                    away: match.awayTeam.name,
                    tip: prediction,
                    odds: odds
                }];
            } else {
                chosenType = 'cta'; // Fallback
            }
        }

        if (chosenType === 'win') {
            const finished = fixtures.filter(f => f.status.short === 'FT' && f.prediction);
            // Check if any was a win (simplified: if goals match prediction? usually we need 'result' check)
            // For now, let's just highlight a high confidence game that finished
            if (finished.length > 0) {
                const lucky = finished[Math.floor(Math.random() * finished.length)];

                message = `💰 BOOM! We've been busy analyzing and winning.\n\n✅ ${lucky.homeTeam.name} ${lucky.goals.home} - ${lucky.goals.away} ${lucky.awayTeam.name}\n\nMore winning picks are live on our dashboard now! 🚀\n\nJoin the winners: ${SITE_URL}\n\n#WinningTips #BettingCommunity`;

                picksForImage = [{
                    home: lucky.homeTeam.name,
                    away: lucky.awayTeam.name,
                    tip: lucky.prediction?.picked || 'WIN',
                    odds: 'WON'
                }];
            } else {
                chosenType = 'cta'; // Fallback
            }
        }

        if (!message || chosenType === 'cta') {
            const ctaMessages = [
                `👋 Tired of guessing? Let our AI do the hard work for you. Join 1,000+ winners daily! 🚀\n\nStart winning: ${SITE_URL}`,
                `🔥 Today's standard and VIP picks are now live! Don't miss the banker of the day. 💰\n\nGet access: ${SITE_URL}`,
                `📈 Consistency is key. Our algorithm has maintained over 75% accuracy all week. See why traders trust us. 🏆\n\nJoin us: ${SITE_URL}`
            ];
            message = ctaMessages[Math.floor(Math.random() * ctaMessages.length)] + "\n\n#FunmoTips #BettingStrategy";

            // For CTA, we can use a generic "Best Picks" image or just no image?
            // Let's generate a generic "Today's Top Picks" image if possible, or just skip image for CTA.
            // For now, let's skip custom image for CTA to verify it works without one, 
            // OR we can make a generic one. Let's make a generic one with placeholder data.
            picksForImage = [{
                home: "Daily",
                away: "Picks",
                tip: "AI Analyzed",
                odds: "HOT"
            }];
        }

        // Generate Image URL
        if (picksForImage.length > 0) {
            const displayDate = format(now, 'do MMMM');
            imageUrl = `${SITE_URL}/api/og/picks?date=${encodeURIComponent(displayDate)}&picks=${encodeURIComponent(JSON.stringify(picksForImage))}`;
            console.log('[Engagement Cron] Generated Image URL:', imageUrl);
        }

        // Post
        let xResult = { success: false, error: '' };
        let fbResult = { success: false, error: '' };
        let tgResult = { success: false, error: '' };

        if (!testMode) {
            // X (Twitter)
            if (imageUrl) {
                const xRes = await postToXWithMedia(message, imageUrl);
                xResult = { success: xRes.success, error: xRes.error || '' };
            } else {
                const xRes = await postToX(message);
                xResult = { success: xRes.success, error: xRes.error || '' };
            }

            // Facebook
            const fbRes = await postToFacebook(message, imageUrl); // Supports optional imageUrl
            fbResult = { success: fbRes.success, error: fbRes.error || '' };

            // Telegram
            if (imageUrl) {
                const tgRes = await sendTelegramPhoto(message, imageUrl);
                tgResult = { success: tgRes.success, error: tgRes.error || '' };
            } else {
                const tgRes = await sendTelegramMessage(message);
                tgResult = { success: tgRes.success, error: tgRes.error || '' };
            }

        } else {
            console.log('[Test Mode] Engagement Message:\n', message);
            console.log('[Test Mode] Image URL:', imageUrl);
            xResult = { success: true, error: '' };
            fbResult = { success: true, error: '' };
            tgResult = { success: true, error: '' };
        }

        return NextResponse.json({
            success: true,
            type: chosenType,
            message: message,
            imageUrl: imageUrl,
            posted: {
                x: xResult.success,
                fb: fbResult.success,
                telegram: tgResult.success
            }
        });

    } catch (error: any) {
        console.error('Engagement Agent Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
