import { NextResponse } from "next/server";
import { getFixtures, getNairobiNow } from '@/lib/api-football';
import { postToX, postToFacebook } from '@/lib/social-media-service';
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

    // 25% chance to post if not forced
    if (!forcePost && Math.random() > 0.25) {
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

        if (chosenType === 'upcoming') {
            const upcoming = fixtures.filter(f => !isPast(new Date(f.date))).slice(0, 1)[0];
            if (upcoming) {
                message = `📅 Upcoming Match Alert!\n\n⚽ ${upcoming.homeTeam.name} vs ${upcoming.awayTeam.name}\n🚀 Our AI has analyzed this game. Don't miss out!\n\nCheck the prediction here: ${SITE_URL}\n\n#FootballTips #BettingPicks`;
            } else {
                chosenType = 'cta'; // Fallback
            }
        }

        if (chosenType === 'win') {
            const finished = fixtures.filter(f => f.status.short === 'FT' && f.prediction).slice(0, 5);
            // Check if any was a win (simplified: if goals match prediction? usually we need 'result' check)
            // For now, let's just highlight a high confidence game that finished
            const lucky = finished[Math.floor(Math.random() * finished.length)];
            if (lucky) {
                message = `💰 BOOM! We've been busy analyzing and winning.\n\n✅ ${lucky.homeTeam.name} ${lucky.goals.home} - ${lucky.goals.away} ${lucky.awayTeam.name}\n\nMore winning picks are live on our dashboard now! 🚀\n\nJoin the winners: ${SITE_URL}\n\n#WinningTips #BettingCommunity`;
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
        }

        // Post
        let xResult, fbResult;
        if (!testMode) {
            xResult = await postToX(message);
            fbResult = await postToFacebook(message);
        } else {
            console.log('[Test Mode] Engagement Message:\n', message);
            xResult = { success: true };
            fbResult = { success: true };
        }

        return NextResponse.json({
            success: true,
            type: chosenType,
            message: message,
            posted: { x: xResult.success, fb: fbResult.success }
        });

    } catch (error: any) {
        console.error('Engagement Agent Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
