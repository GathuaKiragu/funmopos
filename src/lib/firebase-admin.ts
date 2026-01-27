import "server-only";
import * as admin from "firebase-admin";

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
            console.error("FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL missing.");
            // We can't init, so we stop here.
            return false;
        }

        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
            });
            return true;
        } catch (error: any) {
            console.error("Firebase Admin Init Error:", error);
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
