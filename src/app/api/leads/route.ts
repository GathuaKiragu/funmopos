import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export async function POST(request: Request) {
    try {
        const { email, name, phone, source, message } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const leadData = {
            email,
            name: name || null,
            phone: phone || null,
            source: source || 'website',
            message: message || null,
            status: 'new',
            createdAt: Timestamp.now(),
        };

        const leadsRef = collection(db, 'leads');
        const docRef = await addDoc(leadsRef, leadData);

        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error: any) {
        console.error('Lead creation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
