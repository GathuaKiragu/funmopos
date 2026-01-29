import { redis, isRedisEnabled } from './redis';

const DAILY_LIMIT = 100;
const PRIORITY_LEAGUES = [39, 140, 135, 78, 61, 2]; // PL, La Liga, Serie A, Bundesliga, Ligue 1, CL

export type RequestPriority = 'high' | 'medium' | 'low';

/**
 * Check if we can make an API request based on current budget
 * Reserves budget for high-priority requests
 */
export async function canMakeRequest(priority: RequestPriority = 'medium'): Promise<boolean> {
    if (!isRedisEnabled()) {
        console.warn('[Budget] Redis not enabled, allowing request');
        return true;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `api_requests:${today}`;

        const current = await redis.get<number>(key) || 0;

        // Hard limit
        if (current >= DAILY_LIMIT) {
            console.warn(`[Budget] Daily limit reached: ${current}/${DAILY_LIMIT}`);
            return false;
        }

        // Reserve budget for high priority requests
        if (priority === 'low' && current >= 80) {
            console.log(`[Budget] Low priority blocked: ${current}/100 (reserving for high priority)`);
            return false;
        }

        if (priority === 'medium' && current >= 90) {
            console.log(`[Budget] Medium priority blocked: ${current}/100 (reserving for high priority)`);
            return false;
        }

        console.log(`[Budget] Request allowed (${priority}): ${current}/${DAILY_LIMIT}`);
        return true;

    } catch (error) {
        console.error('[Budget] Error checking request budget:', error);
        return true; // Fail open
    }
}

/**
 * Increment the daily request counter
 */
export async function incrementRequestCount(): Promise<void> {
    if (!isRedisEnabled()) {
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `api_requests:${today}`;

        const newCount = await redis.incr(key);
        await redis.expire(key, 86400); // 24 hours

        console.log(`[Budget] Request count incremented: ${newCount}/${DAILY_LIMIT}`);

        // Warn when approaching limit
        if (newCount >= 90) {
            console.warn(`[Budget] ⚠️ Approaching daily limit: ${newCount}/${DAILY_LIMIT}`);
        }

    } catch (error) {
        console.error('[Budget] Error incrementing request count:', error);
    }
}

/**
 * Get current request count for today
 */
export async function getCurrentRequestCount(): Promise<number> {
    if (!isRedisEnabled()) {
        return 0;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `api_requests:${today}`;
        return await redis.get<number>(key) || 0;
    } catch (error) {
        console.error('[Budget] Error getting request count:', error);
        return 0;
    }
}

/**
 * Get remaining requests for today
 */
export async function getRemainingRequests(): Promise<number> {
    const current = await getCurrentRequestCount();
    return Math.max(0, DAILY_LIMIT - current);
}

/**
 * Determine priority based on league ID
 */
export function getLeaguePriority(leagueId: number): RequestPriority {
    if (PRIORITY_LEAGUES.includes(leagueId)) {
        return 'high';
    }
    return 'medium';
}

/**
 * Reset request counter (for testing)
 */
export async function resetRequestCount(): Promise<void> {
    if (!isRedisEnabled()) {
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `api_requests:${today}`;
        await redis.del(key);
        console.log('[Budget] Request counter reset');
    } catch (error) {
        console.error('[Budget] Error resetting request count:', error);
    }
}

/**
 * Get budget status summary
 */
export async function getBudgetStatus(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    percentageUsed: number;
}> {
    const used = await getCurrentRequestCount();
    const remaining = DAILY_LIMIT - used;
    const percentageUsed = (used / DAILY_LIMIT) * 100;

    return {
        used,
        limit: DAILY_LIMIT,
        remaining,
        percentageUsed: Math.round(percentageUsed)
    };
}
