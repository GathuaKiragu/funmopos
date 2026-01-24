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

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

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
