"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Loader2, Phone, ShieldCheck, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Captcha State
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!phone) {
            setError("Please enter your phone number.");
            return;
        }

        if (!captchaToken) {
            setError("Please confirm you are not a robot.");
            return;
        }

        setLoading(true);

        try {
            // Call API to send OTP
            await axios.post("/api/auth/send-otp", { phone, captchaToken });
            setStep("OTP");
            setSuccessMsg("Code sent! Check your SMS.");
        } catch (err: any) {
            console.error("OTP Error Details:", err.response?.data || err);
            setError(err.response?.data?.error || "Failed to send code. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!otp) {
            setError("Please enter the code.");
            return;
        }

        setLoading(true);

        try {
            // Call API to verify OTP
            const res = await axios.post("/api/auth/verify-otp", {
                phone,
                otp,
                name: "Returning User" // We don't ask for name on login
            });

            const { token } = res.data;

            if (token) { // Use 'token' directly as it's destructured from res.data
                await signInWithCustomToken(auth, token);
                // Force router refresh and fast redirect
                router.refresh();
                router.replace("/dashboard");
            } else {
                setError(res.data.error || "Failed to verify OTP"); // Use res.data.error
            }
        } catch (err: any) {
            console.error("Verify Error:", err);
            setError(err.response?.data?.error || "Invalid code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">

            <Link href="/" className="absolute top-8 left-8 inline-flex items-center text-sm text-gray-500 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Link>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-black tracking-tight uppercase italic">Welcome <span className="text-yellow-500">Back</span></h1>
                    <p className="mt-2 text-sm text-gray-400">
                        {step === "PHONE" ? "Enter your phone number to access your picks." : "Enter the 6-digit code sent to your phone."}
                    </p>
                </div>

                <div className="p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm shadow-xl relative">

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-md font-medium">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm rounded-md font-medium">
                            {successMsg}
                        </div>
                    )}

                    {step === "PHONE" ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mobile Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-md pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                        placeholder="0712 345 678"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500">We'll text you a verification code.</p>
                            </div>

                            {/* Real Google reCAPTCHA */}
                            <div className="flex justify-center p-2 rounded-md bg-black/20 border border-white/5 overflow-hidden">
                                <ReCAPTCHA
                                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                                    onChange={(token) => setCaptchaToken(token)}
                                    theme="dark"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-md transition-all hover:scale-[1.01]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "SEND CODE"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Verification Code</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-md pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 tracking-widest font-mono text-center text-xl"
                                        placeholder="000000"
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-md transition-all hover:scale-[1.01]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "VERIFY & LOGIN"}
                            </Button>

                            <button
                                type="button"
                                onClick={() => setStep("PHONE")}
                                className="w-full text-xs text-center text-gray-500 hover:text-white mt-4 underline"
                            >
                                Wrong number? Go back
                            </button>
                        </form>
                    )}
                </div>

                <div className="pt-4 flex items-center justify-center gap-2 text-gray-600">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Trusted • Private • Simple</span>
                </div>
            </div>
        </div>
    );
}
