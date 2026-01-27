import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Checks if a specific identifier (IP or Phone) has exceeded the rate limit.
 * @param identifier Unique ID (IP address or formatted phone number)
 * @param limit Max allowed requests
 * @param windowSeconds Time window in seconds
 * @returns { success: boolean, msg?: string }
 */
export async function checkRateLimit(identifier: string, limit: number = 3, windowSeconds: number = 600): Promise<{ success: boolean; msg?: string }> {
    try {
        const db = getAdminDb();
        const now = Date.now();
        const windowStart = now - (windowSeconds * 1000);

        // Clean identifier to be doc-safe
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

        // Update and set expiry slightly longer than window to auto-clean
        await ref.set({ timestamps: requests }, { merge: true }); // Firestore lacks simplified TTL per field easily without specific setup, but this works for simple logic

        return { success: true };

    } catch (error) {
        console.error("Rate Limit Error:", error);
        // Fail open if DB error, to not block users during outages
        return { success: true };
    }
}
