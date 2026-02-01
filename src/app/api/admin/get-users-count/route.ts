import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        // Check admin authentication
        const cookieStore = await cookies();
        const adminAuth = cookieStore.get('admin-auth');

        if (!adminAuth || adminAuth.value !== 'true') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const db = getAdminDb();

        // Get total users count
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        // Count users with phone numbers
        let usersWithPhone = 0;
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.phoneNumber) {
                usersWithPhone++;
            }
        });

        // Get today's send count
        const today = new Date().toISOString().split('T')[0];
        const limitDoc = await db.collection('sms_limits').doc(today).get();
        const sentToday = limitDoc.exists ? (limitDoc.data()?.count || 0) : 0;

        return NextResponse.json({
            totalUsers,
            usersWithPhone,
            sentToday,
            dailyLimit: 1000,
            remainingToday: Math.max(0, 1000 - sentToday),
        });

    } catch (error: any) {
        console.error('[Get Users Count] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user count' },
            { status: 500 }
        );
    }
}
