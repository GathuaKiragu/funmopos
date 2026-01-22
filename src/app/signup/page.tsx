"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        ageGate: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSignup = async () => {
        setError("");

        // 1. Basic Validation
        if (!formData.name || !formData.email || !formData.password) {
            setError("Please fill in all fields.");
            return;
        }
        if (!formData.ageGate) {
            setError("You must confirm you are over 18 to proceed.");
            return;
        }
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            // 2. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 3. Create Firestore Profile
            // We use the Auth UID as the Document ID for easy lookup
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: formData.name,
                email: formData.email,
                role: "user", // Default role
                subscriptionStatus: "free",
                subscriptionExpiry: null,
                createdAt: serverTimestamp(),
            });

            // 4. Update Auth Profile (Display Name)
            await updateProfile(user, {
                displayName: formData.name
            });

            // 5. Success -> Redirect
            router.push("/");

        } catch (err: any) {
            console.error("Signup Error:", err);
            // Map common firebase errors to user-friendly messages
            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered.");
            } else if (err.code === "auth/invalid-email") {
                setError("Invalid email address.");
            } else {
                setError("Failed to create account. Please try again.");
            }
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
                    <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
                    <p className="mt-2 text-sm text-gray-400">
                        Join the premium community of smart investors
                    </p>
                </div>

                <div className="space-y-4 p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Full Name</label>
                        <input
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            placeholder="John Doe"
                        />
                    </div>

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

                    <div className="flex items-start gap-2 pt-2">
                        <input
                            name="ageGate"
                            type="checkbox"
                            id="age_gate"
                            checked={formData.ageGate}
                            onChange={handleChange}
                            className="mt-1 rounded bg-black/50 border-white/10 text-yellow-500 focus:ring-yellow-500/50"
                        />
                        <label htmlFor="age_gate" className="text-xs text-gray-400">
                            I certify that I am over 18 years of age and I have read and agree to the <Link href="/terms" className="text-yellow-500 underline">Terms of Service</Link> and <Link href="/privacy" className="text-yellow-500 underline">Privacy Policy</Link>.
                        </label>
                    </div>

                    <Button
                        onClick={handleSignup}
                        disabled={loading}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...
                            </>
                        ) : "Create Account"}
                    </Button>

                    <p className="text-center text-sm text-gray-400">
                        Already have an account?{" "}
                        <Link href="/login" className="font-semibold text-yellow-500 hover:text-yellow-400">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
