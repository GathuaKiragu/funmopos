import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

export async function GET() {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get stats from Firestore
        const stats = {
            users: { total: 0, verified: 0, unverified: 0 },
            fixtures: { total: 0, cached: 0 },
            transactions: { total: 0, recent: [] as any[] },
            systemHealth: {
                firestoreConnected: true,
                lastSync: null as string | null,
            }
        };

        try {
            // Count fixtures
            const fixturesSnapshot = await getDocs(collection(db, 'fixtures'));
            stats.fixtures.total = fixturesSnapshot.size;
            stats.fixtures.cached = fixturesSnapshot.size;

            // Get recent transactions
            const transactionsRef = collection(db, 'transactions');
            const recentTxQuery = query(
                transactionsRef,
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const txSnapshot = await getDocs(recentTxQuery);
            stats.transactions.total = txSnapshot.size;
            stats.transactions.recent = txSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
            }));

        } catch (firestoreError) {
            console.error('Firestore error:', firestoreError);
            stats.systemHealth.firestoreConnected = false;
        }

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('Admin stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
