import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { postToFacebook, postToX, postToXWithMedia } from '@/lib/social-media-service';
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram-service';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

export async function POST(request: Request) {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, imageUrl, platform } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const results: any = {
            facebook: { attempted: false },
            x: { attempted: false },
            telegram: { attempted: false }
        };

        // Test Facebook
        if (!platform || platform === 'facebook') {
            results.facebook.attempted = true;
            const fbResult = await postToFacebook(message, imageUrl);
            results.facebook = {
                ...results.facebook,
                success: fbResult.success,
                error: fbResult.error
            };
        }

        // Test X (Twitter)
        if (!platform || platform === 'x') {
            results.x.attempted = true;
            let xResult;
            if (imageUrl) {
                xResult = await postToXWithMedia(message, imageUrl);
            } else {
                xResult = await postToX(message);
            }
            results.x = {
                ...results.x,
                success: xResult.success,
                error: xResult.error
            };
        }

        // Test Telegram
        if (!platform || platform === 'telegram') {
            results.telegram.attempted = true;
            let tgResult;
            if (imageUrl) {
                tgResult = await sendTelegramPhoto(message, imageUrl);
            } else {
                tgResult = await sendTelegramMessage(message);
            }
            results.telegram = {
                ...results.telegram,
                success: tgResult.success,
                error: tgResult.error
            };
        }

        return NextResponse.json({
            success: true,
            results,
            message: 'Test completed'
        });
    } catch (error: any) {
        console.error('Test social media error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
