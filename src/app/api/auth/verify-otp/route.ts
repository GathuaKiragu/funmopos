import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, admin } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const { phone, otp, name } = await request.json();

        if (!phone || !otp) {
            return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
        }

        // Normalize Phone Number (Must match send-otp logic)
        let formattedPhone = phone.replace(/\s+/g, '');
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "+254" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("254")) {
            formattedPhone = "+" + formattedPhone;
        } else if (formattedPhone.length === 9 && /^[0-9]+$/.test(formattedPhone)) {
            formattedPhone = "+254" + formattedPhone;
        }

        // Rate Limit (Phone based verification attempts) to prevent brute force
        const limitPhone = await checkRateLimit(`verify_${formattedPhone}`, 5, 300); // 5 attempts per 5 mins
        if (!limitPhone.success) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

        const db = getAdminDb();
        const auth = getAdminAuth();

        // 1. Verify OTP from Firestore
        const otpRef = db.collection("otps").doc(formattedPhone);
        const otpSnap = await otpRef.get();

        if (!otpSnap.exists) {
            return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
        }

        const otpData = otpSnap.data();
        if (otpData?.otp !== otp) {
            // Increment attempts
            await otpRef.update({ attempts: (otpData?.attempts || 0) + 1 });
            return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
        }

        if (!otpData || Date.now() > otpData.expiresAt) {
            return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
        }

        // 2. Check if user exists or create new one
        let userRecord;
        try {
            // Try to find user by phone number
            userRecord = await auth.getUserByPhoneNumber(formattedPhone);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                userRecord = await auth.createUser({
                    phoneNumber: formattedPhone,
                    displayName: name || "Anonymous User",
                });
                console.log("Created new user:", userRecord.uid);

                // Initialize user document in Firestore - DAY 1 FREE ACCESS LOGIC
                // Grant 24 hours of VIP access (Trial)
                const trialExpiry = new Date();
                trialExpiry.setHours(trialExpiry.getHours() + 24);

                await db.collection("users").doc(userRecord.uid).set({
                    phoneNumber: formattedPhone,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    displayName: name || "User",
                    tier: 'pro', // Give Pro access
                    subscriptionExpiry: admin.firestore.Timestamp.fromDate(trialExpiry),
                    bankroll: 0
                });
            } else {
                throw error;
            }
        }

        // 3. Generate Custom Token for client login
        const customToken = await auth.createCustomToken(userRecord.uid);

        // 4. Delete used OTP
        await otpRef.delete();

        return NextResponse.json({ token: customToken });

    } catch (error: any) {
        console.error("API: Error confirming OTP:", error);

        // Check for specific initialization error
        if (error.message?.includes("Firebase Admin failed to initialize")) {
            return NextResponse.json({
                error: "Server configuration error",
                message: "Firebase credentials missing or invalid in production."
            }, { status: 500 });
        }

        return NextResponse.json({
            error: "Authentication failed",
            message: error.message,
            details: error.toString()
        }, { status: 500 });
    }
}
