import { redis, isRedisEnabled } from "@/lib/redis";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Checks if a specific identifier (IP or Phone) has exceeded the rate limit.
 * Uses Redis if available, falls back to Firestore.
 */
export async function checkRateLimit(identifier: string, limit: number = 3, windowSeconds: number = 600): Promise<{ success: boolean; msg?: string }> {
    try {
        if (isRedisEnabled()) {
            const key = `ratelimit:${identifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const current = await redis.incr(key);

            if (current === 1) {
                await redis.expire(key, windowSeconds);
            }

            if (current > limit) {
                return { success: false, msg: "Too many attempts. Please try again later." };
            }

            return { success: true };
        }

        // --- FALLBACK TO FIRESTORE (Existing Logic) ---
        const db = getAdminDb();
        const now = Date.now();
        const windowStart = now - (windowSeconds * 1000);

        const docId = `ratelimit_${identifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const ref = db.collection('rate_limits').doc(docId);

        const docSnap = await ref.get();
        let requests: number[] = [];

        if (docSnap.exists) {
            const data = docSnap.data();
            requests = (data?.timestamps || []).filter((t: number) => t > windowStart);
        }

        if (requests.length >= limit) {
            return { success: false, msg: "Too many attempts. Please try again later." };
        }

        requests.push(now);
        await ref.set({ timestamps: requests }, { merge: true });

        return { success: true };

    } catch (error) {
        console.error("Rate Limit Error:", error);
        return { success: true }; // Fail open
    }
}
