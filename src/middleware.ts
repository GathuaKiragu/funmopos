import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting (for development)
// In production, use Redis or a proper rate limiting service
const rateLimit = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
    '/api/fixtures': { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
    '/api/admin/sync': { maxRequests: 1, windowMs: 5 * 60 * 1000 }, // 1 request per 5 minutes
    '/api/webhooks': { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
    default: { maxRequests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
};

function getRateLimitKey(ip: string, pathname: string): string {
    return `${ip}:${pathname}`;
}

function checkRateLimit(key: string, limit: { maxRequests: number; windowMs: number }): boolean {
    const now = Date.now();
    const record = rateLimit.get(key);

    if (!record || now > record.resetTime) {
        // New window
        rateLimit.set(key, { count: 1, resetTime: now + limit.windowMs });
        return true;
    }

    if (record.count >= limit.maxRequests) {
        // Rate limit exceeded
        return false;
    }

    // Increment count
    record.count++;
    return true;
}

function base64UrlToBytes(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function isValidAdminSession(token?: string) {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!token || !secret) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    try {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const validSignature = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), new TextEncoder().encode(payload));
        const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
        return validSignature && parsed.role === 'admin' && Number.isInteger(parsed.exp) && parsed.exp > Math.floor(Date.now() / 1000);
    } catch { return false; }
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Every operational route is protected again in its handler. Blocking absent or
    // malformed sessions here prevents accidental exposure when a new route is added.
    if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/auth') {
        if (!await isValidAdminSession(request.cookies.get('admin_session')?.value)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    // Only apply rate limiting to API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';

    // Determine rate limit for this route
    let limit = RATE_LIMITS.default;
    for (const [route, routeLimit] of Object.entries(RATE_LIMITS)) {
        if (route !== 'default' && pathname.startsWith(route)) {
            limit = routeLimit;
            break;
        }
    }

    // Check rate limit
    const key = getRateLimitKey(ip, pathname);
    const allowed = checkRateLimit(key, limit);

    if (!allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(limit.windowMs / 1000)),
                }
            }
        );
    }

    return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
    matcher: '/api/:path*',
};
