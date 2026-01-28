import "server-only";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE = "/tmp/firebase-admin-debug.log";

function logDebug(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (e) {
        console.error("Failed to write to debug log:", e);
    }
}

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        logDebug("Attempting to initialize Firebase Admin...");
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        logDebug(`FIREBASE_PRIVATE_KEY present: ${!!privateKey}`);
        logDebug(`FIREBASE_CLIENT_EMAIL present: ${!!clientEmail}`);
        logDebug(`NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${projectId}`);

        if (!privateKey || !clientEmail || !projectId) {
            const missing = [];
            if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
            if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
            if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

            const msg = `CRITICAL: Missing credentials: ${missing.join(", ")}`;
            console.error(msg);
            logDebug(msg);
            return false;
        }

        try {
            const formattedKey = privateKey.replace(/\\n/g, "\n").replace(/^"(.*)"$/, '$1');
            logDebug(`Formatted Key length: ${formattedKey.length}`);
            logDebug(`Key starts with: ${formattedKey.substring(0, 30)}...`);

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectId,
                    clientEmail: clientEmail,
                    privateKey: formattedKey,
                }),
            });
            logDebug("Firebase Admin initialized successfully.");
            return true;
        } catch (error: any) {
            logDebug(`Firebase Admin Init Error: ${error.message}`);
            logDebug(`Error Stack: ${error.stack}`);
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
