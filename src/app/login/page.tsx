"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Login",
    description: "Sign in to Funmo Tips to access premium football predictions.",
};

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleLogin = async () => {
        setError("");

        if (!formData.email || !formData.password) {
            setError("Please enter your email and password.");
            return;
        }

        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Check if email is verified
            if (!user.emailVerified) {
                setNeedsVerification(true);
                setError("Please verify your email before logging in. Check your inbox/spam folder for the verification link.");
                setLoading(false);
                return;
            }

            router.push("/");
        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                setError("Invalid email or password.");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many attempts. Please try again later.");
            } else {
                setError("Failed to log in. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!auth.currentUser) return;

        setResendingEmail(true);
        try {
            await sendEmailVerification(auth.currentUser);
            setError("");
            alert("Verification email sent! Please check your inbox.");
        } catch (err) {
            console.error("Resend error:", err);
            setError("Failed to resend verification email. Please try again.");
        } finally {
            setResendingEmail(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">

            <Link href="/" className="absolute top-8 left-8 inline-flex items-center text-sm text-gray-500 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Link>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                    <p className="mt-2 text-sm text-gray-400">
                        Sign in to your account to access premium methods
                    </p>
                </div>

                <div className="space-y-4 p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email</label>
                        <input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Password</label>
                        <input
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            placeholder="••••••••"
                        />
                    </div>

                    <Button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing In...
                            </>
                        ) : "Sign In"}
                    </Button>

                    {needsVerification && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm rounded-md">
                            <p className="font-semibold mb-2">Email Not Verified</p>
                            <p className="text-xs mb-3">You need to verify your email before accessing the dashboard.</p>
                            <Button
                                onClick={handleResendVerification}
                                disabled={resendingEmail}
                                variant="outline"
                                className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 text-xs"
                            >
                                {resendingEmail ? "Sending..." : "Resend Verification Email"}
                            </Button>
                        </div>
                    )}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-2 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <Button variant="outline" type="button" disabled className="w-full border-white/10 text-white hover:bg-white/10 disabled:opacity-50">
                        Google (Coming Soon)
                    </Button>

                    <p className="text-center text-sm text-gray-400">
                        Don't have an account?{" "}
                        <Link href="/signup" className="font-semibold text-yellow-500 hover:text-yellow-400">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
