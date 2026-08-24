import { NextResponse } from 'next/server';
import { getAdminDb, admin } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const { email, name, phone, source, message } = await request.json();

        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        const limit = await checkRateLimit(`lead:${request.headers.get('x-forwarded-for') || 'unknown'}`, 5, 3600);
        if (!limit.success) return NextResponse.json({ error: limit.msg }, { status: 429 });

        const leadData = {
            email,
            name: typeof name === 'string' ? name.slice(0, 100) : null,
            phone: typeof phone === 'string' ? phone.slice(0, 30) : null,
            source: typeof source === 'string' ? source.slice(0, 50) : 'website',
            message: typeof message === 'string' ? message.slice(0, 2000) : null,
            status: 'new',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await getAdminDb().collection('leads').add(leadData);

        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error: any) {
        console.error('Lead creation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
