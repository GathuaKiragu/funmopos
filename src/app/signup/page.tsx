"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck, Phone, User, KeyRound, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Make sure this exports your client auth
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";

export default function SignupPage() {
    const router = useRouter();

    // Form State
    const [step, setStep] = useState<1 | 2>(1); // 1 = Details, 2 = Verify OTP
    const [name, setName] = useState("");
    const [phone, setPhone] = useState(""); // User input
    const [otp, setOtp] = useState("");
    const [ageGate, setAgeGate] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const recaptchaRef = useRef<ReCAPTCHA>(null);

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Step 1: Send OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!name || !phone) {
            setError("Please enter your name and phone number.");
            return;
        }

        if (!ageGate) {
            setError("You must confirm you are over 18.");
            return;
        }

        if (!captchaToken) {
            setError("Please confirm you are not a robot.");
            return;
        }

        // Basic phone validation (simple check)
        const cleanPhone = phone.replace(/\s+/g, '');
        if (cleanPhone.length < 9) {
            setError("Please enter a valid phone number.");
            return;
        }

        // Format phone to standard if needed? 
        // Assuming user enters local format (07...) we might want to convert to +254...
        // But let's assume user enters valid international or we handle "07" -> "+2547"
        let formattedPhone = cleanPhone;
        if (formattedPhone.startsWith("07") || formattedPhone.startsWith("01")) {
            formattedPhone = "+254" + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith("+")) {
            // Maybe default to +254 if just 7... but risky.
            // Let user handle it or prompt "+254"
        }

        setLoading(true);

        try {
            await axios.post("/api/auth/send-otp", { phone: formattedPhone, captchaToken, type: 'SIGNUP' });
            setPhone(formattedPhone); // Store formatted version
            setSuccessMsg(`OTP sent to ${formattedPhone}`);
            setStep(2);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || "Failed to send OTP. Try again.");
            // Reset reCAPTCHA on error
            recaptchaRef.current?.reset();
            setCaptchaToken(null);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP & Login
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await axios.post("/api/auth/verify-otp", {
                phone,
                otp,
                name
            });

            const { token } = res.data;

            // Sign in with Firebase
            await signInWithCustomToken(auth, token);

            // Redirect
            router.push("/dashboard");

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || "Invalid OTP. Please try again.");
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-bold uppercase tracking-wide mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                        </span>
                        Join Now
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">
                        Unlock <span className="text-yellow-500">Expert Tips</span>
                    </h1>
                    <p className="mt-2 text-sm text-gray-400">
                        Join 1,000+ winning bettors. {step === 1 ? "Create your account." : "Verify your info."}
                    </p>
                </div>

                <div className="p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm shadow-xl relative overflow-hidden">

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-md animate-in fade-in">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-500 text-sm rounded-md animate-in fade-in">
                            {successMsg}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in duration-500">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-md pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-md pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all font-mono"
                                        placeholder="07XX XXX XXX / +254..."
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500">We'll send a verification code to this number.</p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="age_gate"
                                    checked={ageGate}
                                    onChange={(e) => setAgeGate(e.target.checked)}
                                    className="rounded bg-black/50 border-white/10 text-yellow-500 focus:ring-yellow-500/50"
                                />
                                <label htmlFor="age_gate" className="text-[10px] text-gray-500 leading-tight cursor-pointer">
                                    I am 18+ and agree to the <Link href="/terms" className="text-yellow-500 underline">Terms</Link>.
                                </label>
                            </div>

                            {/* Real Google reCAPTCHA */}
                            <div className="flex justify-center p-2 rounded-md bg-black/20 border border-white/5 overflow-hidden">
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                                    onChange={(token) => setCaptchaToken(token)}
                                    theme="dark"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-md shadow-lg shadow-yellow-500/20 mt-4"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CONTINUE"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-500">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-2">
                                    <KeyRound className="w-6 h-6 text-yellow-500" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Enter OTP</h3>
                                <p className="text-sm text-gray-400">Sent to {phone}</p>
                                <button type="button" onClick={() => setStep(1)} className="text-xs text-yellow-500 hover:underline mt-1">Change Number</button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center block">One-Time Password</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-4 text-white text-center text-2xl tracking-[1em] font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all uppercase"
                                    placeholder="••••••"
                                    maxLength={6}
                                    required
                                    autoFocus
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || otp.length < 5}
                                className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-md shadow-lg shadow-yellow-500/20 mt-4"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "VERIFY & LOGIN"}
                            </Button>
                        </form>
                    )}

                    <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-gray-600">
                        <ShieldCheck className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Instant Verification by Sasa Signal</span>
                    </div>
                </div>

                {step === 1 && (
                    <p className="text-center text-sm text-gray-400">
                        Already have an account?{" "}
                        <Link href="/login" className="font-semibold text-yellow-500 hover:text-yellow-400">
                            Log in
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
}
