import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc } from 'firebase/firestore';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

export async function GET(request: Request) {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const pageSize = parseInt(searchParams.get('limit') || '20');
        const lastId = searchParams.get('lastId');
        const search = searchParams.get('search') || '';

        let usersQuery;
        const usersRef = collection(db, 'users');

        if (search) {
            // Simple search by phone number (exact match or start string if possible, but Firestore is limited)
            // Or search by tier
            // For now, let's assume phone number search
            usersQuery = query(
                usersRef,
                where('phoneNumber', '>=', search),
                where('phoneNumber', '<=', search + '\uf8ff'),
                limit(pageSize)
            );
        } else {
            // Default pagination
            if (lastId) {
                const lastDocSnap = await getDoc(doc(db, 'users', lastId));
                if (lastDocSnap.exists()) {
                    usersQuery = query(
                        usersRef,
                        orderBy('createdAt', 'desc'),
                        startAfter(lastDocSnap),
                        limit(pageSize)
                    );
                } else {
                    usersQuery = query(usersRef, orderBy('createdAt', 'desc'), limit(pageSize));
                }
            } else {
                usersQuery = query(usersRef, orderBy('createdAt', 'desc'), limit(pageSize));
            }
        }

        const snapshot = await getDocs(usersQuery);
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                phoneNumber: data.phoneNumber,
                displayName: data.displayName,
                tier: data.tier,
                bankroll: data.bankroll,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || null,
                subscriptionExpiry: data.subscriptionExpiry?.toDate?.()?.toISOString() || null
            };
        });

        return NextResponse.json({
            users,
            lastId: users.length > 0 ? users[users.length - 1].id : null,
            hasMore: users.length === pageSize
        });

    } catch (error: any) {
        console.error('Admin users error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
