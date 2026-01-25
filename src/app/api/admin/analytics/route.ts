import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, Timestamp, addDoc } from 'firebase/firestore';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    return !!session;
}

// GET analytics data
export async function GET() {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const analytics = {
            pageViews: [] as any[],
            leads: [] as any[],
            recentActivity: [] as any[],
            stats: {
                totalViews: 0,
                totalLeads: 0,
                viewsToday: 0,
                leadsToday: 0,
            }
        };

        try {
            // Get page views
            const viewsRef = collection(db, 'analytics_views');
            const viewsQuery = query(viewsRef, orderBy('timestamp', 'desc'), limit(100));
            const viewsSnapshot = await getDocs(viewsQuery);

            analytics.pageViews = viewsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null
            }));
            analytics.stats.totalViews = viewsSnapshot.size;

            // Get leads
            const leadsRef = collection(db, 'leads');
            const leadsQuery = query(leadsRef, orderBy('createdAt', 'desc'), limit(50));
            const leadsSnapshot = await getDocs(leadsQuery);

            analytics.leads = leadsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
            }));
            analytics.stats.totalLeads = leadsSnapshot.size;

            // Calculate today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            analytics.stats.viewsToday = analytics.pageViews.filter(v =>
                v.timestamp && new Date(v.timestamp) >= today
            ).length;

            analytics.stats.leadsToday = analytics.leads.filter(l =>
                l.createdAt && new Date(l.createdAt) >= today
            ).length;

            // Combine recent activity
            const allActivity = [
                ...analytics.pageViews.map(v => ({ ...v, type: 'view' })),
                ...analytics.leads.map(l => ({ ...l, type: 'lead' }))
            ].sort((a, b) => {
                const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
                const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
                return timeB - timeA;
            }).slice(0, 20);

            analytics.recentActivity = allActivity;

        } catch (firestoreError) {
            console.error('Firestore error:', firestoreError);
        }

        return NextResponse.json(analytics);
    } catch (error: any) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST to track page view
export async function POST(request: Request) {
    try {
        const { page, referrer, userAgent } = await request.json();

        const viewData = {
            page,
            referrer: referrer || null,
            userAgent: userAgent || null,
            timestamp: Timestamp.now(),
        };

        const viewsRef = collection(db, 'analytics_views');
        await addDoc(viewsRef, viewData);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Track view error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
