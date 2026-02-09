import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

interface DailyEngagement {
    date: string;
    signups: number;
    logins: number;
    activeUsers: number;
}

export async function GET() {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get last 30 days of data
        const days = 30;
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Fetch all users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);

        // Initialize daily buckets
        const dailyData = new Map<string, DailyEngagement>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split('T')[0];
            dailyData.set(dateKey, {
                date: dateKey,
                signups: 0,
                logins: 0,
                activeUsers: 0
            });
        }

        // Process each user
        usersSnapshot.docs.forEach(doc => {
            const userData = doc.data();

            // Count signups (createdAt)
            if (userData.createdAt) {
                try {
                    let createdDate: Date;
                    if (userData.createdAt.toDate) {
                        createdDate = userData.createdAt.toDate();
                    } else if (userData.createdAt instanceof Date) {
                        createdDate = userData.createdAt;
                    } else if (typeof userData.createdAt === 'string') {
                        createdDate = new Date(userData.createdAt);
                    } else {
                        return; // Skip if we can't parse it
                    }

                    if (createdDate >= startDate) {
                        const dateKey = createdDate.toISOString().split('T')[0];
                        const bucket = dailyData.get(dateKey);
                        if (bucket) {
                            bucket.signups++;
                        }
                    }
                } catch (err) {
                    console.error('Error parsing createdAt for user:', doc.id, err);
                }
            }

            // Count logins (lastLoginAt)
            if (userData.lastLoginAt) {
                try {
                    let loginDate: Date;
                    if (userData.lastLoginAt.toDate) {
                        loginDate = userData.lastLoginAt.toDate();
                    } else if (userData.lastLoginAt instanceof Date) {
                        loginDate = userData.lastLoginAt;
                    } else if (typeof userData.lastLoginAt === 'string') {
                        loginDate = new Date(userData.lastLoginAt);
                    } else {
                        return; // Skip if we can't parse it
                    }

                    if (loginDate >= startDate) {
                        const dateKey = loginDate.toISOString().split('T')[0];
                        const bucket = dailyData.get(dateKey);
                        if (bucket) {
                            bucket.logins++;
                            // If they logged in, they were active
                            bucket.activeUsers++;
                        }
                    }
                } catch (err) {
                    console.error('Error parsing lastLoginAt for user:', doc.id, err);
                }
            }
        });

        // Convert to array and sort by date
        const engagementData = Array.from(dailyData.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        return NextResponse.json({ data: engagementData });
    } catch (error: any) {
        console.error('User engagement error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
