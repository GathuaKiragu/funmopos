import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendBulkSMS, validateMessage, estimateCost } from '@/lib/sms-service';
import { cookies } from 'next/headers';

// Daily send limit to prevent abuse
const DAILY_SMS_LIMIT = 1000;

export async function POST(request: Request) {
    try {
        // 1. Check admin authentication
        const cookieStore = await cookies();
        const adminAuth = cookieStore.get('admin-auth');

        if (!adminAuth || adminAuth.value !== 'true') {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 401 }
            );
        }

        // 2. Parse request body
        const { message, testMode = false } = await request.json();

        // 3. Validate message
        const validation = validateMessage(message);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const db = getAdminDb();

        // 4. Check daily send limit
        const today = new Date().toISOString().split('T')[0];
        const limitDoc = await db.collection('sms_limits').doc(today).get();
        const currentCount = limitDoc.exists ? (limitDoc.data()?.count || 0) : 0;

        // 5. Fetch all user phone numbers
        const usersSnapshot = await db.collection('users').get();
        const phoneNumbers: string[] = [];

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.phoneNumber) {
                phoneNumbers.push(userData.phoneNumber);
            }
        });

        if (phoneNumbers.length === 0) {
            return NextResponse.json(
                { error: 'No users found with phone numbers' },
                { status: 400 }
            );
        }

        // 6. Check if sending would exceed daily limit
        if (currentCount + phoneNumbers.length > DAILY_SMS_LIMIT) {
            return NextResponse.json(
                {
                    error: `Daily SMS limit exceeded. Already sent ${currentCount}/${DAILY_SMS_LIMIT} today.`,
                    currentCount,
                    limit: DAILY_SMS_LIMIT,
                },
                { status: 429 }
            );
        }

        // 7. Calculate estimated cost
        const estimatedCost = estimateCost(phoneNumbers.length, message);

        // 8. If test mode, return preview without sending
        if (testMode) {
            return NextResponse.json({
                preview: true,
                recipientCount: phoneNumbers.length,
                estimatedCost,
                message,
                sampleRecipients: phoneNumbers.slice(0, 5),
                dailyLimitRemaining: DAILY_SMS_LIMIT - currentCount,
            });
        }

        // 9. Send bulk SMS
        console.log(`[Bulk SMS] Sending to ${phoneNumbers.length} recipients...`);
        const result = await sendBulkSMS(phoneNumbers, message);

        // 10. Update daily send count
        await db.collection('sms_limits').doc(today).set({
            count: currentCount + result.totalSent,
            lastUpdated: new Date().toISOString(),
        });

        // 11. Log the bulk send in audit trail
        await db.collection('bulk_messages').add({
            type: 'sms',
            message,
            recipientCount: phoneNumbers.length,
            successCount: result.totalSent,
            failureCount: result.totalFailed,
            estimatedCost,
            sentAt: new Date().toISOString(),
            status: result.totalFailed === 0 ? 'completed' : 'partial',
            errors: result.errors.slice(0, 10), // Store first 10 errors only
        });

        // 12. Return results
        return NextResponse.json({
            success: true,
            totalSent: result.totalSent,
            totalFailed: result.totalFailed,
            recipientCount: phoneNumbers.length,
            estimatedCost,
            successRate: ((result.totalSent / phoneNumbers.length) * 100).toFixed(1),
            failedNumbers: result.failedNumbers,
            errors: result.errors.slice(0, 5), // Return first 5 errors
        });

    } catch (error: any) {
        console.error('[Bulk SMS] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to send bulk SMS',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
