import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminCookieName, adminSessionMaxAge, createAdminSession } from '@/lib/admin-auth';


export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) throw new Error('ADMIN_PASSWORD is not configured');

        if (typeof password === 'string' && password.length <= 256 && password === adminPassword) {
            const sessionToken = createAdminSession();

            // Set cookie
            const cookieStore = await cookies();
            cookieStore.set(adminCookieName, sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: adminSessionMaxAge,
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete(adminCookieName);
    return NextResponse.json({ success: true });
}
