import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendSasaSMS } from "@/lib/sasa-signal";
import crypto from 'crypto';
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { phone, captchaToken } = body;

        console.log(`API: OTP Request for phone: ${phone}, hasToken: ${!!captchaToken}`);

        if (!phone) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
        }

        // 0. Verify reCAPTCHA
        if (!captchaToken) {
            return NextResponse.json({ error: "Captcha verification required" }, { status: 400 });
        }

        try {
            const secretKey = process.env.RECAPTCHA_SECRET_KEY;
            console.log("reCAPTCHA Verification Attempt...");
            if (!secretKey) {
                console.error("CRITICAL: RECAPTCHA_SECRET_KEY is missing in environment variables!");
                return NextResponse.json({ error: "Server configuration error (reCAPTCHA)" }, { status: 500 });
            }
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
            const verifyRes = await fetch(verifyUrl, { method: "POST" });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                console.error("reCAPTCHA Verification Failed:", verifyData);
                return NextResponse.json({ error: "Captcha verification failed", details: verifyData }, { status: 400 });
            }
            console.log("reCAPTCHA Verified Successfully.");
        } catch (error: any) {
            console.error("reCAPTCHA Error:", error);
            return NextResponse.json({ error: "Failed to verify captcha", message: error.message }, { status: 500 });
        }

        // Normalize Phone Number (Assume Kenya +254 for now if starting with 0)
        let formattedPhone = phone.replace(/\s+/g, ''); // Remove spaces
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "+254" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("254")) {
            formattedPhone = "+" + formattedPhone;
        } else if (formattedPhone.length === 9 && /^[0-9]+$/.test(formattedPhone)) {
            formattedPhone = "+254" + formattedPhone;
        }

        console.log(`API: Sending OTP to ${formattedPhone} (Original: ${phone})`);

        // 0. Rate Limit (IP & Phone)
        const ip = request.headers.get("x-forwarded-for") || "unknown_ip";

        // Check IP limit (5 per 10 mins)
        const limitIp = await checkRateLimit(ip, 5, 600);
        if (!limitIp.success) return NextResponse.json({ error: limitIp.msg }, { status: 429 });

        // Check Phone limit (3 per 10 mins)
        const limitPhone = await checkRateLimit(formattedPhone, 3, 600);
        if (!limitPhone.success) return NextResponse.json({ error: limitPhone.msg }, { status: 429 });

        // 1. Generate OTP (6 digits)
        const otp = crypto.randomInt(100000, 999999).toString();

        // 2. Store in Firestore (Expires in 5 minutes)
        // Use formatted phone as ID
        const otpDoc = {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        };

        try {
            console.log("API: Attempting to store OTP in Firestore...");
            const db = getAdminDb();
            await db.collection("otps").doc(formattedPhone).set(otpDoc);
            console.log("API: OTP Stored in Firestore successfully.");
        } catch (dbError: any) {
            console.error("API: Firestore Error:", dbError);
            return NextResponse.json({
                error: "Database Error",
                message: dbError.message,
                details: "Could not store OTP in Firestore. Check Firebase Admin credentials and permissions."
            }, { status: 500 });
        }

        // 3. Send SMS via Sasa Signal
        const message = `Your Funmo Tips code is: ${otp}. Do not share this code with anyone.`;
        try {
            await sendSasaSMS(formattedPhone, message);
        } catch (smsError: any) {
            console.error("API: SMS Sending Failed:", smsError);
            return NextResponse.json({
                error: "Failed to send SMS",
                message: smsError.message
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "OTP sent successfully" });

    } catch (error: any) {
        console.error("API: Error sending OTP:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            message: error.message,
            details: error.toString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
