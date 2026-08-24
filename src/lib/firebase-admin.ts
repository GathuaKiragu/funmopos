import "server-only";
import * as admin from "firebase-admin";

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;


        if (!privateKey || !clientEmail || !projectId) {
            const missing = [];
            if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
            if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
            if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

            const msg = `CRITICAL: Missing credentials: ${missing.join(", ")}`;
            console.error(msg);
            return false;
        }

        try {
            const formattedKey = privateKey.replace(/\\n/g, "\n").replace(/^"(.*)"$/, '$1');

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectId,
                    clientEmail: clientEmail,
                    privateKey: formattedKey,
                }),
            });
            return true;
        } catch (error: any) {
            console.error("Firebase Admin initialization failed", error instanceof Error ? error.message : "unknown error");
            return false;
        }
    }
    return true;
}

// We wrap the exports to ensure init is attempted before use
export const getAdminDb = () => {
    if (!initFirebaseAdmin()) {
        throw new Error("Firebase Admin failed to initialize. Missing Credentials?");
    }
    return admin.firestore();
}

export const getAdminAuth = () => {
    if (!initFirebaseAdmin()) {
        throw new Error("Firebase Admin failed to initialize. Missing Credentials?");
    }
    return admin.auth();
}
// Re-exporting directly will throw immediately if apps.length is 0.
export { admin }; // Export admin so we can check usage if needed.
